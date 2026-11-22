import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve('.');
const load = () => import('../../lib/doctor.mjs');
const system = {platform:'linux',arch:'x64',node:'24.0.0',cpus:4,memory:8*1024**3,freeMemory:5*1024**3};
const info = {os:'linux',arch:'amd64',cpus:4,memory:8*1024**3,security:[]};
const execute = async (command,args) => ({code:0,stdout:args[0]==='info'?JSON.stringify(args.includes('{{json .SecurityOptions}}')?[]:info):'2.40.0',stderr:''});
async function temp(t) {
  const path=await mkdtemp(join(tmpdir(),'potato-doctor-'));
  t.after(()=>rm(path,{recursive:true,force:true})); return path;
}
const profile = {schema:1,projects:[{path:'.',language:'typescript',manifests:['package.json'],lockfiles:['package-lock.json']}],
  checks:{full:['npm','test'],fast:['npm','run','test:unit'],lint:['npm','run','lint'],types:['npm','run','typecheck'],
    unit:['npm','run','test:unit'],integration:['npm','run','test:integration'],security:['gitleaks','detect'],hooks:['pre-commit','run','--all-files']},
  coverage:{unit:['coverage/unit.json'],integration:['coverage/integration.json']},ui:{required:false,reason:'No browser UI'}};
async function repo(t, document=profile) {
  const path=await temp(t); await mkdir(join(path,'.potato')); await mkdir(join(path,'.git'));
  await writeFile(join(path,'AGENTS.md'),'Use the local gate.');
  await writeFile(join(path,'package.json'),'{}'); await writeFile(join(path,'package-lock.json'),'{}');
  await writeFile(join(path,'.potato/repository.json'),JSON.stringify(document)); return path;
}
test('doctor exposes machine checks without executing setup or repository code',async t=>{
  const {doctor}=await load(), cwd=await temp(t),calls=[];
  const report=await doctor({root,cwd},{system,execute:async(c,a)=>{calls.push([c,...a]);return execute(c,a);}});
  assert.equal(report.ready,true); assert.equal(report.configurationReady,true);
  assert.ok(report.checks.some(c=>c.id==='machine.docker'&&c.status==='PASS'));
  assert.ok(!calls.flat().some(x=>['build','run','up','login','install','test'].includes(x)));
});
test('missing Docker and unsupported hosts fail without leaking tool output',async t=>{
  const {doctor}=await load(),cwd=await temp(t);
  const report=await doctor({root,cwd},{system:{...system,platform:'win32',node:'20.0.0'},execute:async()=>{throw new Error('secret-token');}});
  assert.equal(report.ready,false); assert.ok(report.checks.filter(c=>c.status==='FAIL').length>=3);
  assert.ok(!JSON.stringify(report).includes('secret-token'));
});
test('malformed engine data, low disk and insufficient VM memory cannot pass',async t=>{
  const {doctor}=await load(),cwd=await temp(t);
  for(const stdout of ['bad',JSON.stringify({...info,memory:1024})]) {
    const report=await doctor({root,cwd,memory:'4g',minFreeDisk:'999999g'},{system,execute:async()=>({code:0,stdout,stderr:''})});
    assert.equal(report.ready,false);
  }
  await assert.rejects(doctor({root,cwd,memory:'Infinity'},{system,execute}),/size/i);
});
test('repository commands are inspected without running them and absent profiles are incomplete',async t=>{
  const {doctor}=await load(),path=await repo(t),calls=[];
  const report=await doctor({root,cwd:path,repo:path},{system,execute:async(c,a)=>{calls.push(c);return execute(c,a);}});
  assert.equal(report.configurationReady,true);
  assert.ok(!calls.includes('npm'));
  await rm(join(path,'.potato/repository.json'));
  const missing=await doctor({root,cwd:path,repo:path},{system,execute});
  assert.equal(missing.ready,false);
  assert.ok(missing.checks.some(c=>c.id==='repo.profile'&&c.status==='NOT CHECKED'&&c.required));
});
test('repository-only checks work inside a coding container without a Docker socket',async t=>{
  const {doctor}=await load(),path=await repo(t),calls=[];
  const report=await doctor({root,cwd:path,repo:path,repoOnly:true},{system,execute:async(c,a)=>{calls.push(c);throw new Error('No Docker socket');}});
  assert.equal(report.ready,true); assert.deepEqual(calls,[]);
  await assert.rejects(doctor({root,repoOnly:true},{system,execute}),/repo/i);
});
test('invalid profiles, empty commands, missing lockfiles and escaped paths block repository readiness',async t=>{
  const {doctor}=await load();
  for(const change of [{schema:2},{checks:{...profile.checks,full:[]}},{coverage:{}},
    {projects:[{path:'..',language:'typescript',manifests:['package.json'],lockfiles:['package-lock.json']}]},
    {projects:[{path:'.',language:'typescript',manifests:['package.json'],lockfiles:['missing.lock']}]}]) {
    const path=await repo(t,{...profile,...change});
    assert.equal((await doctor({root,cwd:path,repo:path},{system,execute})).ready,false);
  }
});
test('UI readiness requires a declared browser profile and an explicit successful browser probe',async t=>{
  const {doctor}=await load();
  const path=await repo(t,{...profile,ui:{required:true,binding:'node',path:'.',package:'@playwright/test',browser:'chromium',command:['npm','run','test:e2e']},coverage:{...profile.coverage,ui:['reports/ui.json']}});
  await writeFile(join(path,'package.json'),JSON.stringify({devDependencies:{'@playwright/test':'1.58.2'}}));
  const waiting=await doctor({root,cwd:path,repo:path},{system,execute});
  assert.equal(waiting.ready,false);
  const calls=[];
  const passed=await doctor({root,cwd:path,repo:path,probe:true},{system,execute:async(c,a)=>{calls.push([c,...a]);return execute(c,a);}});
  assert.equal(passed.ready,true); assert.ok(calls.some(c=>c.includes('--eval')));
  const failed=await doctor({root,cwd:path,repo:path,probe:true},{system,execute:async(c,a)=>a.includes('--eval')?{code:1,stdout:'',stderr:'private-cookie'}:execute(c,a)});
  assert.equal(failed.ready,false); assert.ok(!JSON.stringify(failed).includes('private-cookie'));
});
test('Python browser profiles tolerate an unprepared venv but require its explicit probe to succeed',async t=>{
  const {doctor}=await load();
  const ui={required:true,binding:'python',path:'.',python:'.venv/bin/python',version:'1.58.2',browser:'chromium',command:['uv','run','pytest','tests/browser']};
  const path=await repo(t,{...profile,ui,coverage:{...profile.coverage,ui:['reports/ui.json']}});
  const pending=await doctor({root,cwd:path,repo:path},{system,execute});
  assert.equal(pending.configurationReady,true); assert.equal(pending.ready,false);
  await mkdir(join(path,'.venv/bin'),{recursive:true});
  await symlink(join(root,'.venv/bin/python'),join(path,'.venv/bin/python'));
  const report=await doctor({root,cwd:path,repo:path,probe:true},{system,execute});
  assert.equal(report.ready,true);
  ui.version='latest';
  await writeFile(join(path,'.potato/repository.json'),JSON.stringify({...profile,ui,coverage:{...profile.coverage,ui:['reports/ui.json']}}));
  assert.equal((await doctor({root,cwd:path,repo:path},{system,execute})).ready,false);
});
test('a mismatched installed Playwright package fails before any browser launch',async t=>{
  const {doctor}=await load(), {runCommand}=await import('../../lib/system.mjs');
  const path=await repo(t,{...profile,ui:{required:true,binding:'node',path:'.',package:'@playwright/test',browser:'chromium',command:['npm','run','test:e2e']},coverage:{...profile.coverage,ui:['reports/ui.json']}});
  await writeFile(join(path,'package.json'),JSON.stringify({devDependencies:{'@playwright/test':'1.58.2'}}));
  const installed=join(path,'node_modules/@playwright/test'); await mkdir(installed,{recursive:true});
  await writeFile(join(installed,'package.json'),JSON.stringify({version:'1.57.0',main:'index.js'}));
  const report=await doctor({root,cwd:path,repo:path,probe:true},{system,execute:(c,a,settings)=>a.includes('--eval')?runCommand(c,a,settings):execute(c,a)});
  assert.equal(report.ready,false); assert.ok(report.checks.some(c=>c.id==='repo.browser'&&c.status==='FAIL'));
});
test('symlinks escaping the repository fail inspection',async t=>{
  const {doctor}=await load(),path=await repo(t),outside=await temp(t);
  await writeFile(join(outside,'secret'),'secret'); await rm(join(path,'package-lock.json'));
  await symlink(join(outside,'secret'),join(path,'package-lock.json'));
  assert.equal((await doctor({root,cwd:path,repo:path},{system,execute})).ready,false);
});
test('null profiles and a missing directory cannot report preflight readiness',async t=>{
  const {doctor}=await load(),path=await repo(t,null);
  assert.equal((await doctor({root,cwd:path,repo:path},{system,execute})).ready,false);
  assert.equal((await doctor({root,cwd:path,repo:join(path,'missing')},{system,execute})).ready,false);
});
test('a forged or tampered bundle cannot start a container probe',async t=>{
  const {doctor}=await load(),path=await temp(t),calls=[];
  await writeFile(join(path,'bundle.json'),JSON.stringify({token_file:'do-not-read',files_sha256:{'../secret':'a'.repeat(64)}}));
  const report=await doctor({root,cwd:path,bundle:path,probe:true},{system,execute:async(c,a)=>{calls.push([c,...a]);return execute(c,a);}});
  assert.equal(report.ready,false); assert.ok(!calls.some(c=>c[1]==='run'));
});
test('valid prepared bundles reuse the existing image doctor but never imply native extension certification',async t=>{
  const {doctor}=await load(),path=await temp(t);
  const {spawnSync}=await import('node:child_process');
  const catalog=JSON.parse(await readFile(join(root,'config/toolchain.json'),'utf8'));
  const release=join(path,'release-input.json'); await writeFile(release,JSON.stringify({schema:1,image:'sha256:'+'a'.repeat(64),tools:catalog.tools}));
  const bundle=join(path,'worker');
  const result=spawnSync(join(root,'.venv/bin/python'),[join(root,'scripts/prepare-runner.py'),'--release',release,'--output',bundle,'--server','https://multica.example.test','--workspace','dev','--token-file',join(path,'missing-token')],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const calls=[];
  const report=await doctor({root,cwd:path,bundle,probe:true},{system,execute:async(c,a)=>{
    calls.push([c,...a]);
    if(a[0]==='run') return {code:0,stdout:JSON.stringify(Object.keys(catalog.tools).map(tool=>({tool,ok:true,expected:catalog.tools[tool]}))),stderr:''};
    return execute(c,a);
  }});
  assert.equal(report.configurationReady,true); assert.equal(report.ready,false);
  assert.ok(report.checks.some(c=>c.id==='runner.extensions'&&c.status==='NOT CHECKED'&&c.required));
  assert.ok(calls.some(c=>c.includes('/opt/potato/scripts/doctor-runner.py')));
  const incomplete=await doctor({root,cwd:path,bundle,probe:true},{system,execute:async(c,a)=>a[0]==='run'?{code:0,stdout:'[]',stderr:''}:execute(c,a)});
  assert.ok(incomplete.checks.some(c=>c.id==='runner.tools'&&c.status==='FAIL'));
  const unprobed=await doctor({root,cwd:path,bundle},{system,execute});
  assert.ok(unprobed.checks.some(c=>c.id==='runner.tools'&&c.status==='NOT CHECKED'));
  const originalCompose=await readFile(join(bundle,'compose.json'),'utf8');
  const originalMetadata=await readFile(join(bundle,'bundle.json'),'utf8');
  for(const mutate of [c=>{c.volumes['runner-home']={external:true,name:'shared-production'};},c=>{c.services.runner.cap_add=['SYS_ADMIN'];}]) {
    const compose=JSON.parse(originalCompose); mutate(compose);
    const bytes=JSON.stringify(compose), metadata=JSON.parse(originalMetadata);
    metadata.files_sha256['compose.json']=createHash('sha256').update(bytes).digest('hex');
    await writeFile(join(bundle,'compose.json'),bytes); await writeFile(join(bundle,'bundle.json'),JSON.stringify(metadata));
    assert.equal((await doctor({root,cwd:path,bundle},{system,execute})).configurationReady,false);
  }
  await writeFile(join(bundle,'compose.json'),originalCompose); await writeFile(join(bundle,'bundle.json'),originalMetadata);
  await writeFile(join(bundle,'compose.json'),'{}');
  assert.equal((await doctor({root,cwd:path,bundle},{system,execute})).configurationReady,false);
  const metadata=JSON.parse(await readFile(join(bundle,'bundle.json'),'utf8'));
  metadata.files_sha256['compose.json']=createHash('sha256').update('{}').digest('hex');
  await writeFile(join(bundle,'bundle.json'),JSON.stringify(metadata));
  assert.equal((await doctor({root,cwd:path,bundle},{system,execute})).configurationReady,false);
});
test('doctor human output labels unchecked results and strips terminal control characters',async()=>{
  const {formatDoctor}=await load();
  const text=formatDoctor({ready:false,checks:[{status:'NOT CHECKED',id:'repo.browser',detail:'\x1b]0;untrusted\x07',remedy:'Run --probe'}],limits:['No code tests ran.']});
  assert.ok(text.includes('NOT CHECKED')); assert.ok(text.includes('Fix: Run --probe')); assert.ok(!text.includes('\x1b'));
  assert.ok(formatDoctor({ready:true,checks:[],limits:[]}).includes('passed'));
});
