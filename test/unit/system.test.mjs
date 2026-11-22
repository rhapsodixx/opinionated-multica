import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runCommand, inspectDocker } from '../../lib/system.mjs';
test('bounded probes stop hung processes and retain only bounded output',async()=>{
  const timed=await runCommand(process.execPath,['-e','setTimeout(()=>{},60000)'],{timeout:100});
  assert.equal(timed.code,124);
  const output=await runCommand(process.execPath,['-e','process.stdout.write("a".repeat(100000));process.stderr.write("b".repeat(100000))']);
  assert.equal(output.stdout.length,32768); assert.equal(output.stderr.length,32768);
});
test('Docker capacity rejects malformed security and unsupported engines',async()=>{
  for(const info of ['{}','["rootless"]']) {
    await assert.rejects(inspectDocker(async(c,a)=>({code:0,stdout:a[0]==='info'?info:'1.0.0',stderr:''}),{capacity:true}));
  }
});
