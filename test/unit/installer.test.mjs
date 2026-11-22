import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateOptions, runSetup } from '../../lib/installer.mjs';
import { createProgress, showBanner } from '../../lib/terminal.mjs';

const options = (root) => ({ server: 'https://multica.example.test', workspace: 'engineering',
  output: join(root, 'worker one'), tokenFile: join(root, 'private token'), cpus: '2', memory: '4g' });
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'potato-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'config'));
  await writeFile(join(root, 'config/toolchain.json'), JSON.stringify({ schema: 1, tools: { node: '24.0.0' } }));
  return root;
}
function fakeDocker(calls, { standalone = false, fail = '' } = {}) {
  return async (command, args) => {
    calls.push([command, ...args]);
    if (standalone && command === 'docker' && args[0] === 'compose') return { code: 1, stdout: '', stderr: 'not installed' };
    if (args.includes(fail)) return { code: 1, stdout: '', stderr: 'synthetic failure' };
    if (args[0] === 'info') return {code:0,stdout:'[]',stderr:''};
    if (args[0] === 'build') await writeFile(args[args.indexOf('--iidfile') + 1], 'sha256:' + 'a'.repeat(64));
    if (args.includes('/opt/potato/scripts/prepare-runner.py')) {
      const output = args[args.indexOf('--output') + 1];
      await mkdir(output);
      await writeFile(join(output, 'compose.json'), '{}');
    }
    return { code: 0, stdout: '1.0.0', stderr: '' };
  };
}
test('validates scope and rejects credentials, invalid limits and bind-path delimiters', () => {
  const input = options('/tmp');
  assert.equal(validateOptions(input).cpus, 2);
  for (const change of [{server:'http://remote.example.test'}, {server:'https://user:secret@example.test'},
    {server:'https://example.test/path'}, {workspace:'bad workspace'}, {cpus:'0'}, {cpus:'Infinity'},
    {memory:'unlimited'}, {output:'/tmp/bad:path'}, {tokenFile:'/tmp/bad\npath'}, {server:''}]) {
    assert.throws(() => validateOptions({...input,...change}));
  }
  assert.equal(validateOptions({...input,server:'http://localhost:8080'}).server, 'http://localhost:8080');
});
test('builds, verifies, prepares and validates without token reads, login or startup', async t => {
  const root=await fixture(t), calls=[];
  await runSetup(options(root), {root,execute:fakeDocker(calls)});
  assert.ok(calls.some(c=>c.includes('build')));
  const doctor=calls.find(c=>c.includes('/opt/potato/scripts/doctor-runner.py'));
  const prepare=calls.find(c=>c.includes('/opt/potato/scripts/prepare-runner.py'));
  assert.ok(doctor.includes('--network') && doctor.includes('none'));
  assert.ok(prepare.includes(join(root, 'private token')));
  assert.equal(calls.at(-1).at(-1), '--quiet');
  assert.ok(!calls.flat().some(c=>['login','up','start'].includes(c)));
  assert.deepEqual(await readdir(root), ['config', 'worker one']);
});
test('uses standalone Compose when the Docker plugin is unavailable', async t => {
  const root=await fixture(t), calls=[];
  await runSetup(options(root), {root,execute:fakeDocker(calls,{standalone:true})});
  assert.equal(calls.at(-1)[0], 'docker-compose');
});
test('refuses nonempty output and symlinks before invoking Docker', async t => {
  const root=await fixture(t), calls=[], opts=options(root);
  await mkdir(opts.output); await writeFile(join(opts.output,'keep.txt'),'keep');
  await assert.rejects(runSetup(opts,{root,execute:fakeDocker(calls)}), /empty|exist/i);
  assert.equal(await readFile(join(opts.output,'keep.txt'),'utf8'), 'keep');
  await rm(opts.output,{recursive:true}); await symlink(join(root,'config'),opts.output);
  await assert.rejects(runSetup(opts,{root,execute:fakeDocker(calls)}), /symlink/i);
  assert.equal(calls.length,0);
});
test('stops on missing daemon, build failure, failed doctor and Compose failure', async t => {
  for (const fail of ['version','build','/opt/potato/scripts/doctor-runner.py','config']) {
    const root=await fixture(t),calls=[];
    await assert.rejects(runSetup(options(root),{root,execute:fakeDocker(calls,{fail})}));
    if(fail!=='config') assert.ok(!calls.some(c=>c.includes('/opt/potato/scripts/prepare-runner.py')));
    assert.ok(!calls.flat().includes('login'));
  }
});
test('plain output has no terminal control sequences and animated mode restores the cursor', async () => {
  let text=''; const stream={isTTY:false,write:s=>{text+=s}};
  showBanner(stream); let end=createProgress(stream).start('Check Docker');end();
  assert.ok(text.includes('POTATO')); assert.ok(!text.includes('\x1b'));
  text='';stream.isTTY=true;
  end=createProgress(stream,{animate:true}).start('Build image');
  await new Promise(resolve=>setTimeout(resolve,140));end(new Error('fail'));
  assert.ok(text.includes('\x1b[?25h'));
  text='';createProgress(stream,{animate:false}).start('Quiet')();assert.ok(!text.includes('\x1b'));
});

test('command execution keeps arguments literal and reports exits and missing binaries', async () => {
  const { runCommand } = await import('../../lib/installer.mjs');
  const result = await runCommand(process.execPath, ['-e', 'process.stdout.write(process.argv[1])', '$(not-a-command) with spaces']);
  assert.equal(result.stdout, '$(not-a-command) with spaces');
  assert.equal(result.code, 0);
  const failed = await runCommand(process.execPath, ['-e', 'process.stderr.write("expected");process.exit(7)']);
  assert.equal(failed.code, 7); assert.equal(failed.stderr, 'expected');
  await assert.rejects(runCommand('/potato/nonexistent-command', []), /ENOENT/);
});
test('rejects a malformed image ID before running the version doctor', async t => {
  const root=await fixture(t),calls=[]; const execute=fakeDocker(calls);
  await assert.rejects(runSetup(options(root),{root,execute:async(command,args)=>{
    const result=await execute(command,args);
    if(args[0]==='build') await writeFile(args[args.indexOf('--iidfile')+1],'mutable:latest');
    return result;
  }}),/immutable image ID/);
  assert.ok(!calls.some(c=>c.includes('/opt/potato/scripts/doctor-runner.py')));
});

test('failed validation leaves no partial bundle and the same output can be retried', async t => {
  const root=await fixture(t), opts=options(root);
  await assert.rejects(runSetup(opts,{root,execute:fakeDocker([],{fail:'config'})}));
  assert.deepEqual(await readdir(root), ['config']);
  await runSetup(opts,{root,execute:fakeDocker([])});
  assert.ok((await readdir(opts.output)).includes('compose.json'));
});
test('temporary bind files stay beside the selected output on the same shared host path', async t => {
  const root=await fixture(t), calls=[];
  await runSetup(options(root),{root,execute:fakeDocker(calls)});
  const doctor=calls.find(c=>c.includes('/opt/potato/scripts/doctor-runner.py'));
  const source=doctor[doctor.indexOf('--volume')+1];
  assert.ok(source.startsWith(root + '/'), source);
});

test('rootless Docker prepares as container root mapped to the invoking host user', async t => {
  const root=await fixture(t), calls=[], execute=fakeDocker(calls);
  await runSetup(options(root),{root,execute:async(command,args)=>{
    const result=await execute(command,args);
    if(args[0]==='info') return {...result,stdout:'["name=rootless"]'};
    return result;
  }});
  const prepare=calls.find(c=>c.includes('/opt/potato/scripts/prepare-runner.py'));
  assert.equal(prepare[prepare.indexOf('--user')+1],'0:0');
});

test('publishes into an existing empty directory and preserves operator files added during setup', async t => {
  const root=await fixture(t), opts=options(root);
  await mkdir(opts.output);
  await runSetup(opts,{root,execute:fakeDocker([])});
  assert.ok((await readdir(opts.output)).includes('compose.json'));
  const next={...opts,output:join(root,'another worker')}; const calls=[], execute=fakeDocker(calls);
  await assert.rejects(runSetup(next,{root,execute:async(command,args)=>{
    const result=await execute(command,args);
    if(args.includes('config') && args.includes('--quiet')) {
      await mkdir(next.output); await writeFile(join(next.output,'operator.txt'),'keep');
    }
    return result;
  }}), /Output changed/);
  assert.equal(await readFile(join(next.output,'operator.txt'),'utf8'),'keep');
});
