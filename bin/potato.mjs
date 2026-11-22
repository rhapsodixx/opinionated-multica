#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSetup, validateOptions } from '../lib/installer.mjs';
import { createProgress, showBanner } from '../lib/terminal.mjs';

const help = `Usage: potato [setup] [options]

Build the shared toolchain image and prepare a Multica runner bundle.
Host prerequisites: Node 22.8+, Docker with a running engine, Docker Compose.

  --server URL          Multica HTTPS origin (loopback HTTP is allowed)
  --workspace SLUG      Workspace name
  --output PATH         New or empty bundle directory
  --token-file PATH     Later login token path; never read during setup
  --cpus NUMBER         Runner CPU limit (default: 2)
  --memory SIZE         Runner memory limit (default: 4g)
  --yes                 Confirm build/preparation without a prompt
  --plan                Show the steps without Docker calls or file writes
  --no-animation        Plain progress output
  --help                Show this help

No login, daemon startup, npm publication or image publication occurs.
Use the generated start-runner.sh later on the chosen worker VM.
`;
async function main() {
  const args = process.argv.slice(2);
  if (args[0] === 'setup') args.shift();
  const { values } = parseArgs({ args, options: {
    server: {type:'string'}, workspace: {type:'string'}, output: {type:'string'}, 'token-file': {type:'string'},
    cpus: {type:'string',default:'2'}, memory: {type:'string',default:'4g'}, yes: {type:'boolean'},
    plan: {type:'boolean'}, 'no-animation': {type:'boolean'}, help: {type:'boolean',short:'h'},
  } });
  showBanner(process.stdout);
  if (values.help) { process.stdout.write(help); return; }
  if (values.plan) {
    process.stdout.write('1. Check Docker and Compose.\n2. Build the pinned runner image.\n3. Verify installed tool versions.\n4. Prepare the bundle.\n5. Validate Compose.\n\nNo login or runner startup. No files were written.\n'); return;
  }
  if (process.platform === 'win32') throw new Error('Use WSL for the runner setup command.');
  let rl;
  try {
    for (const [name, prompt] of [['server','Multica server origin'], ['workspace','Workspace slug'], ['output','Bundle output directory'], ['token-file','Token-file path for later login']]) {
      if (!values[name]) {
        if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error(`Missing --${name}. Use --help or run the interactive wizard.`);
        rl ??= createInterface({input:process.stdin,output:process.stdout});
        values[name] = await rl.question(`${prompt}: `);
      }
    }
    const options = validateOptions({ ...values, tokenFile: values['token-file'] });
    if (!values.yes) {
      if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Pass --yes for noninteractive setup, or use --plan.');
      rl ??= createInterface({input:process.stdin,output:process.stdout});
      process.stdout.write(`\nBuild the image and prepare ${options.output}.\nDocker will download the pinned tools. Login and startup stay explicit.\n`);
      if (!/^y(es)?$/i.test((await rl.question('Continue? [y/N] ')).trim())) { process.stdout.write('Cancelled. No setup commands ran.\n'); return; }
    }
    rl?.close(); rl = undefined;
    const controller = new AbortController();
    const interrupt = () => controller.abort();
    process.once('SIGINT', interrupt);
    try {
      const result = await runSetup(options, {
        root: resolve(dirname(fileURLToPath(import.meta.url)), '..'), signal: controller.signal,
        progress: createProgress(process.stdout, {animate:!values['no-animation'] && !process.env.NO_COLOR && process.env.TERM !== 'dumb'}),
      });
      process.stdout.write(`\nReady: ${result.output}\nImage: ${result.image}\nNo token was read. No runner was started.\nNext: review the generated start-runner.sh, then run it with --plan\n`);
    } finally { process.removeListener('SIGINT', interrupt); }
  } finally { rl?.close(); }
}
main().catch(error => { process.stderr.write(`potato: ${error.name === 'AbortError' ? 'Setup interrupted.' : error.message}\n`); process.exitCode = error.name === 'AbortError' ? 130 : 1; });
