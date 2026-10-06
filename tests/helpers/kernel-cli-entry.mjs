import {fileURLToPath} from 'node:url';

export const withEnv=(patch,fn)=>{
  const saved=new Map();
  for(const [key,value] of Object.entries(patch??{})){
    saved.set(key,process.env[key]);
    if(value===null)delete process.env[key];
    else process.env[key]=String(value);
  }
  return Promise.resolve().then(fn).finally(()=>{
    for(const [key,value] of saved){
      if(value===undefined)delete process.env[key];
      else process.env[key]=value;
    }
  });
};

const API=new URL('../../scripts/kernel/cli.mjs',import.meta.url);

// Runs the real kernel CLI entry in this process: a distinct URL re-evaluates cli.mjs, then its exported main()
// runs with the given argv. The verb's exit status is process.exitCode, as in a real process.
export const runKernelCliEntry=async({args,tag,sequence})=>{
  const stdout=[];
  const stderr=[];
  const original={argv:process.argv,log:console.log,error:console.error,exitCode:process.exitCode};
  process.argv=[process.execPath,fileURLToPath(import.meta.url),...args];
  process.exitCode=undefined;
  console.log=(...parts)=>{stdout.push(parts.map(String).join(' '));};
  console.error=(...parts)=>{stderr.push(parts.map(String).join(' '));};
  try{
    const entry=new URL(API);
    entry.searchParams.set(tag,String(sequence));
    const {main}=await import(entry.href);
    await main();
    return {status:process.exitCode??0,stdout:`${stdout.join('\n')}\n`,stderr:stderr.length?`${stderr.join('\n')}\n`:''};
  }catch(error){
    const printed=lines=>`${lines.join('\n')}${lines.length?'\n':''}`;
    return {status:1,stdout:printed(stdout),stderr:`${printed(stderr)}${error?.stack??error}\n`};
  }finally{
    process.argv=original.argv;
    process.exitCode=original.exitCode;
    console.log=original.log;
    console.error=original.error;
  }
};
