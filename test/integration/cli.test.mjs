import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, mkdirSync, writeFileSync, chmodSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
const cli=resolve('bin/potato.mjs');
const run=(args,extra={})=>spawnSync(process.execPath,[cli,...args],{encoding:'utf8',...extra});
test('help and plan work without Docker or setup inputs and never write files',()=>{
  const cwd=mkdtempSync(join(tmpdir(),'potato-plan-'));
  try {
    for(const args of [['--help'],['--plan'],['setup','--plan','--no-animation']]) {
      const result=run(args,{cwd,env:{...process.env,PATH:''}});
      assert.equal(result.status,0,result.stderr);
      assert.ok(result.stdout.includes('POTATO'));
      assert.ok(!result.stdout.includes('\x1b'));
    }
    assert.deepEqual(readdirSync(cwd),[]);
  } finally {rmSync(cwd,{recursive:true});}
});
test('noninteractive setup requires explicit fields and yes; invalid arguments fail',()=>{
  for(const args of [[],['--yes'],['--unknown'],['unrecognized']]) {
    const result=run(args);assert.notEqual(result.status,0);
    assert.ok(result.stderr.includes('potato:'));
  }
});
test('shell wrapper forwards plan mode',()=>{
  const result=spawnSync('bash',[resolve('setup.sh'),'--plan'],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);assert.ok(result.stdout.includes('No login'));
});

test('successful setup never prints an executable shell command containing the output path',()=>{
  const root=mkdtempSync(join(tmpdir(),'potato-cli-'));
  try {
    const bindir=join(root,'bin');mkdirSync(bindir);
    const docker=join(bindir,'docker');
    writeFileSync(docker, '#!'+process.execPath+'\n'+`import{writeFileSync,mkdirSync}from'node:fs';const a=process.argv.slice(2);if(a[0]==='info')process.stdout.write('[]');if(a[0]==='build')writeFileSync(a[a.indexOf('--iidfile')+1],'sha256:'+'a'.repeat(64));if(a.includes('/opt/potato/scripts/prepare-runner.py')){const p=a[a.indexOf('--output')+1];mkdirSync(p);writeFileSync(p+'/compose.json','{}');}\n`);
    chmodSync(docker,0o755);
    const output=join(root,"bundle-$HOME-$(printf EXPANDED)-'quote");
    const result=run(['--yes','--no-animation','--server','https://multica.example.test','--workspace','dev','--output',output,'--token-file',join(root,'missing-token')],{env:{...process.env,PATH:bindir+':'+process.env.PATH}});
    assert.equal(result.status,0,result.stderr);
    const next=result.stdout.split('\n').find(line=>line.startsWith('Next:'));
    assert.ok(!next.includes(output));
    assert.ok(next.includes('start-runner.sh'));
  } finally {rmSync(root,{recursive:true,force:true});}
});
test('npm package includes the image assets but excludes local runner caches and private files',()=>{
  const root=mkdtempSync(join(tmpdir(),'potato-pack-'));
  try {
    writeFileSync(join(root,'package.json'),readFileSync(resolve('package.json')));
    mkdirSync(join(root,'runner/__pycache__'),{recursive:true});
    writeFileSync(join(root,'runner/start-runner.sh'),'#!/bin/bash\n');
    writeFileSync(join(root,'runner/__pycache__/local.pyc'),'local-cache');
    writeFileSync(join(root,'runner/private.txt'),'synthetic private fixture');
    const result=spawnSync('npm',['pack','--dry-run','--json'],{cwd:root,encoding:'utf8',env:{...process.env,npm_config_cache:join(root,'npm-cache')}});
    assert.equal(result.status,0,result.stderr);
    const paths=JSON.parse(result.stdout)[0].files.map(file=>file.path);
    assert.ok(paths.includes('runner/start-runner.sh'));
    assert.ok(!paths.some(path=>path.includes('__pycache__')||path.includes('private.txt')));
  } finally {rmSync(root,{recursive:true,force:true});}
});
