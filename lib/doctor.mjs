import { access, readFile, realpath, stat, statfs } from 'node:fs/promises';
import { constants } from 'node:fs';
import { cpus, freemem, totalmem } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { inspectDocker, runCommand } from './system.mjs';

const BUNDLE_FILES=['release.json','compose.json','multica-claude.local.md','claude-settings.json','claude-launcher.sh','entrypoint.sh','start-runner.sh'];
const CHECKS=['full','fast','lint','types','unit','integration','security','hooks'];
const command=value=>Array.isArray(value)&&value.length>0&&value.every(arg=>typeof arg==='string'&&arg.trim()&&!arg.includes('\0'));
const exactVersion=value=>typeof value==='string'&&/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(value);
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const gi=bytes=>`${(bytes/1024**3).toFixed(1)} GiB`;
export function parseSize(value) {
  if(typeof value!=='string'||!/^\d+[mg]$/.test(value)||Number.parseInt(value)<=0) throw new Error('Use a positive size such as 4g or 4096m.');
  const bytes=Number.parseInt(value)*1024**(value.endsWith('g')?3:2);
  if(!Number.isSafeInteger(bytes)) throw new Error('Size exceeds the supported range.');
  return bytes;
}
async function inside(root,path,{exists=true}={}) {
  if(typeof path!=='string'||!path||isAbsolute(path)) throw new Error('Expected a relative path.');
  const base=await realpath(root), target=resolve(base,path), rel=relative(base,target);
  if(rel==='..'||rel.startsWith('..'+sep)) throw new Error('Path escapes its root.');
  if(exists) {
    const actual=await realpath(target), actualRel=relative(base,actual);
    if(actualRel==='..'||actualRel.startsWith('..'+sep)) throw new Error('Symlink escapes its root.');
    return actual;
  }
  return target;
}

export async function doctor(options,{execute=(command,args,settings)=>runCommand(command,args,{timeout:15000,...settings}),system={platform:process.platform,arch:process.arch,node:process.versions.node,
  cpus:cpus().length,memory:totalmem(),freeMemory:freemem()}}={}) {
  const {root,probe=false}=options, cwd=resolve(options.cwd??process.cwd());
  if(options.repoOnly&&(!options.repo||options.bundle)) throw new Error('--repo-only requires --repo and cannot inspect a bundle.');
  const requiredMemory=options.memory?parseSize(options.memory):undefined;
  const minimumDisk=options.minFreeDisk?parseSize(options.minFreeDisk):undefined;
  const requiredCpus=options.cpus===undefined?undefined:Number(options.cpus);
  if(requiredCpus!==undefined&&(!Number.isFinite(requiredCpus)||requiredCpus<=0)) throw new Error('CPUs must be positive and finite.');
  const checks=[];
  const add=(id,status,detail,remedy='',required=true,operational=false)=>checks.push({id,status,required,operational,detail,remedy});
  const attempt=async(id,work,remedy,operational=false)=>{
    try {await work();return true;}
    catch {add(id,'FAIL','The check failed or its input was unavailable.',remedy,true,operational);return false;}
  };
  const [major,minor]=system.node.split('.').map(Number);
  add('machine.node',major>22||(major===22&&minor>=8)?'PASS':'FAIL',`Node ${system.node}`,'Use Node 22.8 or later.');
  add('machine.platform',['linux','darwin'].includes(system.platform)&&['x64','arm64'].includes(system.arch)?'PASS':'FAIL',
    `${system.platform}/${system.arch}`,'Use native Linux containers on Linux, macOS/Colima or WSL2.');
  add('machine.memory','WARN',`Host: ${gi(system.memory)} total; ${gi(system.freeMemory)} currently free; ${system.cpus} logical CPUs.`,
    'Free memory is advisory, not available-memory pressure. Measure job peaks and keep host headroom.',false);
  await attempt('machine.workspace',async()=>{
    await access(cwd,constants.R_OK|constants.W_OK);
    const fs=await statfs(cwd), free=fs.bavail*fs.bsize;
    add('machine.workspace',minimumDisk!==undefined&&free<minimumDisk?'FAIL':'PASS',`${gi(free)} available on the workspace filesystem.`,
      'Free task-owned storage or select a workspace with the approved disk budget.');
    if(minimumDisk===undefined) add('machine.disk-budget','WARN','No measured disk budget was supplied.',
      'Measure image/cache/worktree peaks, then pass --min-free-disk SIZE.',false);
  },'Select an existing readable, writable workspace.');
  let docker;
  if(!options.repoOnly) await attempt('machine.docker',async()=>{
    docker=await inspectDocker(execute,{capacity:true});
    add('machine.docker','PASS',`Linux engine ${docker.info.arch}; ${docker.info.cpus} CPUs; ${gi(docker.info.memory)} RAM; ${docker.compose.join(' ')}.`);
    const native=system.arch==='arm64'?['arm64','aarch64']:['amd64','x86_64'];
    add('machine.architecture',native.includes(docker.info.arch)?'PASS':'FAIL','Compare the host and Docker engine architectures.',
      'Use a local native-architecture engine; certify remote or emulated execution separately.');
    if(requiredMemory!==undefined||requiredCpus!==undefined) add('machine.capacity',
      (requiredMemory!==undefined&&requiredMemory>docker.info.memory)||(requiredCpus!==undefined&&requiredCpus>docker.info.cpus)?'FAIL':'PASS',
      'Compare the requested runner limits with Docker VM capacity.','Increase VM capacity or select a reviewed smaller runner profile.');
  },'Start the approved Docker engine. On macOS check Colima and the Compose plugin/context. Inside a coding container use --repo-only --repo PATH.');
  else add('machine.docker','N/A','Repository-only scope does not require a Docker socket. Run host preflight separately.','',false);

  if(options.bundle) {
    const bundle=resolve(options.bundle);
    await attempt('runner.bundle',async()=>{
      const metadata=await json(await inside(bundle,'bundle.json'));
      if(!metadata.files_sha256||Object.keys(metadata.files_sha256).sort().join()!==[...BUNDLE_FILES].sort().join()) throw new Error('Invalid bundle inventory.');
      for(const name of BUNDLE_FILES) {
        const bytes=await readFile(await inside(bundle,name));
        if(createHash('sha256').update(bytes).digest('hex')!==metadata.files_sha256[name]) throw new Error('Bundle changed.');
        if(!['release.json','compose.json'].includes(name)&&!bytes.equals(await readFile(join(root,'runner',name)))) throw new Error('Runner asset differs from this release.');
      }
      const release=await json(join(bundle,'release.json')), catalog=await json(join(root,'config/toolchain.json'));
      if(release.schema!==1||typeof release.image!=='string'||! /^(?:[\w][\w./:-]*@)?sha256:[0-9a-f]{64}$/.test(release.image)
        ||!release.tools||Object.keys(release.tools).sort().join()!==Object.keys(catalog.tools).sort().join()
        ||Object.keys(catalog.tools).some(key=>release.tools[key]!==catalog.tools[key])) throw new Error('Unapproved release.');
      const compose=await json(join(bundle,'compose.json')), runner=compose.services?.runner;
      const allowed=['image','init','user','entrypoint','environment','volumes','cpus','mem_limit','pids_limit','cap_drop','security_opt','restart','logging'];
      if(!runner||Object.keys(compose.services).length!==1||runner.image!==release.image||runner.user!=='10001:10001'||runner.privileged||runner.ports?.length
        ||Object.keys(runner).some(key=>!allowed.includes(key))||Object.keys(compose).some(key=>!['services','volumes'].includes(key))
        ||Object.keys(compose.volumes??{}).join()!=='runner-home'||Object.keys(compose.volumes['runner-home']??{invalid:true}).length!==0
        ||!runner.cap_drop?.includes('ALL')||!runner.security_opt?.includes('no-new-privileges:true')
        ||runner.environment?.MULTICA_DAEMON_MAX_CONCURRENT_TASKS!=='1'||!Number.isFinite(runner.cpus)||runner.cpus<=0
        ||!Array.isArray(runner.volumes)||runner.volumes.length!==5||new Set(runner.volumes.map(mount=>mount.target)).size!==5
        ||runner.network_mode==='host'||runner.command||JSON.stringify(runner.entrypoint)!==JSON.stringify(['/bin/bash','/etc/potato/entrypoint.sh'])) throw new Error('Unsafe runner configuration.');
      const memory=parseSize(runner.mem_limit);
      for(const mount of runner.volumes) {
        if(mount.type==='volume'&&mount.source==='runner-home'&&mount.target==='/home/runner') continue;
        const name=mount.source?.slice(2);
        if(mount.type!=='bind'||!['multica-claude.local.md','claude-settings.json','claude-launcher.sh','entrypoint.sh'].includes(name)
          ||mount.source!==`./${name}`||mount.target!==`/etc/potato/${name}`||mount.read_only!==true) throw new Error('Unsafe mount.');
      }
      add('runner.bundle','PASS','Bundle hashes, approved tool catalog, immutable image and isolated Compose settings match.');
      if(docker) add('runner.capacity',runner.cpus<=docker.info.cpus&&memory<=docker.info.memory?'PASS':'FAIL',
        'Compare bundle limits with the Docker VM.','Select a reviewed profile that fits this Docker VM.');
      if(probe&&docker) {
        await attempt('runner.tools',async()=>{
          if(/[,\r\n]/.test(bundle)) throw new Error('Unsupported mount path.');
          const result=await execute('docker',['run','--rm','--pull','never','--network','none','--read-only','--tmpfs','/tmp:rw,nosuid,size=64m',
            '--cap-drop','ALL','--security-opt','no-new-privileges','--cpus','1','--memory','1g',
            '--mount',`type=bind,source=${join(bundle,'release.json')},target=/tmp/release.json,readonly`,
            '--entrypoint','python3',release.image,'/opt/potato/scripts/doctor-runner.py','--release','/tmp/release.json'],{timeout:240000});
          if(result.code!==0) throw new Error('Image doctor failed.');
          const rows=JSON.parse(result.stdout);
          if(!Array.isArray(rows)||rows.length!==Object.keys(catalog.tools).length||new Set(rows.map(row=>row.tool)).size!==rows.length
            ||Object.keys(catalog.tools).some(tool=>!rows.some(row=>row.tool===tool&&row.ok===true&&row.expected===catalog.tools[tool]))) throw new Error('Incomplete tool evidence.');
          add('runner.tools','PASS','The existing image doctor verified every pinned tool in a disposable, offline container.');
        },'Build or pull the approved image explicitly, then rerun --probe.',true);
      } else add('runner.tools','NOT CHECKED','The image version doctor did not execute.', 'Use --probe with the approved image already present.',true,true);
      add('runner.extensions','NOT CHECKED','Native skill/plugin/hook/MCP execution and Claude/Multica authentication are not certified by file inspection.',
        'Complete headless extension, identity and connectivity acceptance on the real runtime.',true,true);
      add('runner.integrity','WARN','Bundle hashes detect drift; they are not a signature or proof of release provenance.',
        'Use the approved release source and native acceptance records.',false);
    },'Regenerate a clean bundle from the approved release. Do not edit hashes to hide drift.');
  }

  if(options.repo) {
    const repo=resolve(options.repo);
    let profile;
    const present=await attempt('repo.directory',async()=>{if(!(await stat(repo)).isDirectory()) throw new Error('Not a directory.');},'Select an existing repository directory.');
    if(present) {
      await attempt('repo.git',async()=>{await inside(repo,'.git');add('repo.git','PASS','Git checkout metadata exists; no Git hooks or commands executed.');},'Use a clean Git checkout or worktree.');
      await attempt('repo.instructions',async()=>{
        let found=false;
        for(const name of ['AGENTS.md','CLAUDE.md']) {try {await inside(repo,name);found=true;} catch {}}
        if(!found) throw new Error('No guidance.');
        add('repo.instructions','PASS','Repository guidance exists. Content and engine neutrality still need human review.');
      },'Add engine-agnostic AGENTS.md or CLAUDE.md with the approved build/test commands.');
      try {
        profile=await json(await inside(repo,'.potato/repository.json'));
        if(!profile||typeof profile!=='object'||Array.isArray(profile)) throw new Error('Expected profile object.');
      }
      catch(error) {
        profile=undefined;
        add('repo.profile',error.code==='ENOENT'?'NOT CHECKED':'FAIL','The repository profile is missing, unreadable or invalid.',
          'Create and approve .potato/repository.json using docs/doctor.md.');
      }
      if(profile) await attempt('repo.profile',async()=>{
        if(profile.schema!==1||!Array.isArray(profile.projects)||!profile.projects.length) throw new Error('Invalid profile.');
        for(const project of profile.projects) {
          if(!['typescript','javascript','python','go'].includes(project.language)||!Array.isArray(project.manifests)||!project.manifests.length
            ||!Array.isArray(project.lockfiles)) throw new Error('Invalid project.');
          const directory=await inside(repo,project.path);
          if(!(await stat(directory)).isDirectory()) throw new Error('Invalid project directory.');
          for(const path of [...project.manifests,...project.lockfiles]) {if(!(await stat(await inside(directory,path))).isFile()) throw new Error('Missing project file.');}
          if(project.language!=='go'&&!project.lockfiles.length) throw new Error('Locked dependencies required.');
        }
        for(const key of CHECKS) if(!command(profile.checks?.[key])) throw new Error('Missing check command.');
        for(const key of ['unit','integration',...(profile.ui?.required?['ui']:[])]) {
          const paths=profile.coverage?.[key];
          if(!Array.isArray(paths)||!paths.length) throw new Error('Missing coverage declaration.');
          for(const path of paths) await inside(repo,path,{exists:false});
        }
        if(typeof profile.ui?.required!=='boolean'||(!profile.ui.required&&(typeof profile.ui.reason!=='string'||!profile.ui.reason.trim()))) throw new Error('Explain UI applicability.');
        if(profile.ui.required) {
          const ui=profile.ui, directory=await inside(repo,ui.path);
          if(!['node','python'].includes(ui.binding)||!['chromium','firefox','webkit'].includes(ui.browser)||!command(ui.command)) throw new Error('Invalid UI profile.');
          let program, args;
          if(ui.binding==='node') {
            if(!['@playwright/test','playwright'].includes(ui.package)) throw new Error('Invalid Playwright package.');
            const pkg=await json(await inside(directory,'package.json')), version=pkg.devDependencies?.[ui.package]??pkg.dependencies?.[ui.package];
            if(!exactVersion(version)) throw new Error('Pin Playwright exactly.');
            program=process.execPath;
            args=['--eval',`const {createRequire}=require('node:module');const r=createRequire(process.argv[1]+'/package.json');if(r(${JSON.stringify(ui.package+'/package.json')}).version!==${JSON.stringify(version)})throw Error('version drift');const p=r(${JSON.stringify(ui.package)});(async()=>{const b=await p.${ui.browser}.launch({headless:true});const page=await b.newPage();await page.setContent('<main>potato doctor</main>');if(await page.locator('main').textContent()!=='potato doctor')throw Error('probe');await b.close();})().catch(()=>process.exit(1));`,directory];
          } else {
            if(!exactVersion(ui.version)) throw new Error('Pin Python Playwright exactly.');
            await inside(directory,ui.python,{exists:false});
            if(probe) {
              const parent=await inside(directory,dirname(ui.python));
              program=join(parent,basename(ui.python));
              await access(program,constants.X_OK);
            }
            args=['-c',`from importlib.metadata import version\nassert version('playwright') == ${JSON.stringify(ui.version)}\nfrom playwright.sync_api import sync_playwright\nwith sync_playwright() as p:\n b=p.${ui.browser}.launch(headless=True)\n page=b.new_page()\n page.set_content('<main>potato doctor</main>')\n assert page.locator('main').inner_text() == 'potato doctor'\n b.close()\n`];
          }
          add('repo.playwright-config','PASS',`Declared ${ui.binding} Playwright journey command and ${ui.browser} browser.`,
            'Check the repository lock and installed package/browser revisions together.');
          if(probe) await attempt('repo.browser',async()=>{
            const result=await execute(program,args,{timeout:30000});
            if(result.code!==0) throw new Error('Browser probe failed.');
            add('repo.browser','PASS','A headless browser launched and passed a synthetic local-page assertion. No product journey ran.');
          },'Install the repository-locked Playwright package and matching browser, then rerun --probe.',true);
          else add('repo.browser','NOT CHECKED','No browser launch or assertion ran.', 'Use --probe in the intended repository runtime.',true,true);
        } else add('repo.browser','N/A',profile.ui.reason,'',false);
        add('repo.profile','PASS','Project manifests/locks exist; full/fast and check commands plus coverage paths are declared. Commands were not executed.');
        add('repo.execution','NOT CHECKED','Tests, coverage generation, hook behavior, runtime compatibility and application readiness were not executed.',
          'Run the approved repository profile on the candidate commit; inspect actual results and coverage.',false,true);
      },'Correct the repository profile, project paths, locks, coverage declarations and Playwright settings.');
    }
  }
  const configurationReady=checks.every(check=>!check.required||check.operational||['PASS','N/A'].includes(check.status));
  const ready=checks.every(check=>!check.required||['PASS','N/A'].includes(check.status));
  return {schema:1,scope:'preflight',ready,configurationReady,checks,
    limits:['Readiness covers only the listed checks. It does not certify a code change, test adequacy or production safety.',
      'Doctor does not read token files or copy personal settings. Repository commands, login, installation and service startup were not performed.',
      ...(!probe?['Live image/browser probes were not requested.']:['Explicit probes may execute installed repository packages; use only an approved checkout.'])]};
}

export function formatDoctor(report) {
  const plain=value=>String(value).replace(/[\x00-\x1f\x7f]/g,' ');
  return [report.ready?'Potato doctor: preflight passed.':'Potato doctor: required checks failed or remain unchecked.',
    ...report.checks.map(row=>`${row.status.padEnd(11)} ${row.id}: ${plain(row.detail)}${row.remedy&&row.status!=='PASS'?`\n            Fix: ${plain(row.remedy)}`:''}`),
    ...report.limits.map(line=>`Note: ${line}`)].join('\n')+'\n';
}
