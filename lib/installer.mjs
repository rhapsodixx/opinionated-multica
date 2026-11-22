import { spawn } from 'node:child_process';
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, rename, rmdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

export function validateOptions(input) {
  const url = new URL(input.server);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash
      || !['', '/'].includes(url.pathname) || (url.protocol === 'http:' && !['localhost','127.0.0.1','[::1]'].includes(url.hostname))) {
    throw new Error('Use an HTTPS server origin, or loopback HTTP. Do not put credentials in the URL.');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(input.workspace ?? '')) throw new Error('Workspace must be a slug.');
  const cpus = Number(input.cpus ?? 2), memory = input.memory ?? '4g';
  if (!Number.isFinite(cpus) || cpus <= 0) throw new Error('CPUs must be positive and finite.');
  if (!/^[1-9]\d*[mg]$/.test(memory)) throw new Error('Memory must be a size such as 4g or 4096m.');
  for (const key of ['output', 'tokenFile']) {
    if (typeof input[key] !== 'string' || !input[key].trim() || /[:\r\n]/.test(input[key])) throw new Error(`${key} must be a nonempty path without colons or newlines.`);
  }
  return { server: url.origin, workspace: input.workspace, output: resolve(input.output), tokenFile: resolve(input.tokenFile), cpus, memory };
}

export function runCommand(command, args, { signal } = {}) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(command, args, { shell: false, signal, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', data => { stdout = (stdout + data).slice(-32768); });
    child.stderr.on('data', data => { stderr = (stderr + data).slice(-32768); });
    child.on('error', reject);
    child.on('close', code => resolveResult({ code: code ?? 1, stdout, stderr }));
  });
}

export async function runSetup(input, { root, execute = runCommand, progress, signal } = {}) {
  const opts = validateOptions(input);
  try {
    const stat = await lstat(opts.output);
    if (stat.isSymbolicLink()) throw new Error('Output must not be a symlink.');
    if (!stat.isDirectory() || (await readdir(opts.output)).length) throw new Error('Choose a new or empty output directory; existing files are never overwritten.');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const lock = JSON.parse(await readFile(join(root, 'config/toolchain.json'), 'utf8'));
  const checked = async (command, args) => {
    const result = await execute(command, args, { signal });
    if (result.code !== 0) throw new Error(`${command} ${args[0]} failed. ${result.stderr?.slice(-2000) ?? ''}`);
    return result;
  };
  const stage = async (label, work) => {
    const end = progress?.start(label) ?? (() => {});
    try { const result = await work(); end(); return result; }
    catch (error) { end(error); throw error; }
  };
  let preparerUser = `${process.getuid()}:${process.getgid()}`;
  const compose = await stage('1/5 Check Docker and Compose', async () => {
    await checked('docker', ['version', '--format', '{{.Server.Version}}']);
    const info = await checked('docker', ['info', '--format', '{{json .SecurityOptions}}']);
    const security = JSON.parse(info.stdout);
    if (!Array.isArray(security)) throw new Error('Docker returned invalid security options.');
    if (security.some(value => String(value).includes('rootless'))) preparerUser = '0:0';
    try { await checked('docker', ['compose', 'version', '--short']); return ['docker', 'compose']; }
    catch { await checked('docker-compose', ['version', '--short']); return ['docker-compose']; }
  });
  const parent = dirname(opts.output);
  await mkdir(parent, { recursive: true });
  const temporary = await mkdtemp(join(parent, '.potato-setup-'));
  const staged = join(temporary, 'bundle');
  try {
    const idFile = join(temporary, 'image-id');
    await stage('2/5 Build the pinned toolchain image', () => checked('docker', ['build', '--pull', '--iidfile', idFile,
      '--file', join(root, 'runner/Dockerfile'), '--tag', 'potato-runner:0.1.0', root]));
    const image = (await readFile(idFile, 'utf8')).trim();
    if (!/^sha256:[0-9a-f]{64}$/.test(image)) throw new Error('Docker did not return an immutable image ID.');
    const release = { schema: 1, image, tools: lock.tools };
    const releaseFile = join(temporary, 'release.json');
    await writeFile(releaseFile, JSON.stringify(release, null, 2) + '\n', { mode: 0o644 });
    await chmod(releaseFile, 0o644); // Public version metadata; readable by the nonroot doctor even with umask 077.
    const common = ['run', '--rm', '--network', 'none', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
      '--volume', `${releaseFile}:/tmp/potato-release.json:ro`, '--entrypoint', 'python3'];
    await stage('3/5 Verify every installed tool version', () => checked('docker', [...common, image,
      '/opt/potato/scripts/doctor-runner.py', '--release', '/tmp/potato-release.json']));
    await stage('4/5 Prepare the runner bundle', () => checked('docker', [...common,
      '--user', preparerUser, '--volume', `${temporary}:${temporary}`, image,
      '/opt/potato/scripts/prepare-runner.py', '--release', '/tmp/potato-release.json', '--output', staged,
      '--server', opts.server, '--workspace', opts.workspace, '--token-file', opts.tokenFile,
      '--cpus', String(opts.cpus), '--memory', opts.memory]));
    await stage('5/5 Validate Compose configuration', () => checked(compose[0], [...compose.slice(1), '-f', join(staged, 'compose.json'), 'config', '--quiet']));
    try {
      const stat = await lstat(opts.output);
      if (stat.isSymbolicLink() || !stat.isDirectory() || (await readdir(opts.output)).length) throw new Error('Output changed during setup; refusing to replace it.');
      await rmdir(opts.output); // Remove only an empty directory; never delete operator files.
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await rename(staged, opts.output);
    return { output: opts.output, image };
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
