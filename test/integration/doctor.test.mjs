import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const cli=resolve('bin/potato.mjs');
test('doctor JSON is parseable with Docker missing and creates no files',()=>{
  const cwd=mkdtempSync(join(tmpdir(),'potato-doctor-cli-'));
  try {
    const result=spawnSync(process.execPath,[cli,'doctor','--json'],{cwd,encoding:'utf8',env:{...process.env,PATH:''}});
    const report=JSON.parse(result.stdout);
    assert.equal(result.status,1); assert.equal(report.ready,false); assert.equal(report.schema,1);
    assert.ok(report.checks.some(c=>c.id==='machine.docker'&&c.status==='FAIL'));
    assert.deepEqual(readdirSync(cwd),[]);
  } finally {rmSync(cwd,{recursive:true,force:true});}
});
test('doctor help is available without Docker and rejects unrelated setup flags',()=>{
  const help=spawnSync(process.execPath,[cli,'doctor','--help'],{encoding:'utf8',env:{...process.env,PATH:''}});
  assert.equal(help.status,0); assert.ok(help.stdout.includes('--probe'));
  const invalid=spawnSync(process.execPath,[cli,'doctor','--yes'],{encoding:'utf8'});
  assert.notEqual(invalid.status,0);
});
test('the packed npm artifact runs doctor from an empty directory without missing modules',()=>{
  const path=mkdtempSync(join(tmpdir(),'potato-doctor-pack-'));
  try {
    const packed=spawnSync('npm',['pack','--json','--pack-destination',path],{cwd:resolve('.'),encoding:'utf8',env:{...process.env,npm_config_cache:join(path,'npm-cache')}});
    assert.equal(packed.status,0,packed.stderr);
    const filename=JSON.parse(packed.stdout)[0].filename;
    const extracted=spawnSync('tar',['-xzf',join(path,filename),'-C',path],{encoding:'utf8'});
    assert.equal(extracted.status,0,extracted.stderr);
    const cwd=join(path,'empty'); mkdirSync(cwd);
    const result=spawnSync(process.execPath,[join(path,'package/bin/potato.mjs'),'doctor','--json'],{cwd,encoding:'utf8',env:{...process.env,PATH:''}});
    assert.equal(result.status,1,result.stderr);
    assert.equal(JSON.parse(result.stdout).schema,1);
    assert.deepEqual(readdirSync(cwd),[]);
  } finally {rmSync(path,{recursive:true,force:true});}
});
