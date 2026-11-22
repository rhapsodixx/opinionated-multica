import { spawn } from 'node:child_process';

export function runCommand(command, args, {signal, timeout = 0} = {}) {
  return new Promise((resolve, reject) => {
    const group=timeout>0&&process.platform!=='win32';
    const child = spawn(command, args, {shell:false, signal, detached:group, stdio:['ignore','pipe','pipe']});
    let stdout='', stderr='', timedOut=false;
    const timer=timeout?setTimeout(()=>{
      timedOut=true;
      try {if(group) process.kill(-child.pid,'SIGKILL');else child.kill('SIGKILL');} catch {}
    },timeout):undefined;
    child.stdout.on('data',data=>{stdout=(stdout+data).slice(-32768);});
    child.stderr.on('data',data=>{stderr=(stderr+data).slice(-32768);});
    child.on('error',error=>{clearTimeout(timer);reject(error);});
    child.on('close',code=>{clearTimeout(timer);resolve({code:timedOut?124:(code??1),stdout,stderr});});
  });
}

// Both setup and doctor use the same daemon and Compose discovery.
export async function inspectDocker(execute, {capacity=false} = {}) {
  const checked=async(command,args)=>{
    const result=await execute(command,args);
    if(result.code!==0) throw new Error('Docker or Compose is unavailable.');
    return result.stdout;
  };
  await checked('docker',['version','--format','{{.Server.Version}}']);
  const security=JSON.parse(await checked('docker',['info','--format','{{json .SecurityOptions}}']));
  if(!Array.isArray(security)) throw new Error('Invalid Docker security information.');
  let compose;
  try {await checked('docker',['compose','version','--short']);compose=['docker','compose'];}
  catch {await checked('docker-compose',['version','--short']);compose=['docker-compose'];}
  let info;
  if(capacity) {
    info=JSON.parse(await checked('docker',['info','--format',
      '{"os":{{json .OSType}},"arch":{{json .Architecture}},"cpus":{{json .NCPU}},"memory":{{json .MemTotal}}}']));
    if(!info || info.os!=='linux' || !['amd64','x86_64','arm64','aarch64'].includes(info.arch)
        || !Number.isFinite(info.cpus) || info.cpus<=0 || !Number.isFinite(info.memory) || info.memory<=0)
      throw new Error('Unsupported or incomplete Docker capacity.');
  }
  return {compose,info,rootless:security.some(value=>String(value).includes('rootless'))};
}
