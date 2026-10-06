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

// A verb that refuses ends with process.exit(code); in this long-lived process that call unwinds the verb as a signal
// and the run reports the code, exactly as a real process would exit with it.
const EXIT_MESSAGE='process.exit(';
class ExitSignal extends Error{constructor(code){super(`${EXIT_MESSAGE}${code})`);this.exitCode=code;}}

// Runs the real kernel CLI entry in this process: a distinct URL re-evaluates cli.mjs, then its exported main()
// runs with the given argv. The verb's exit status is process.exitCode or its process.exit code, as in a real process.
export const runKernelCliEntry=async({args,tag,sequence})=>{
  const stdout=[];
  const stderr=[];
  const original={argv:process.argv,log:console.log,error:console.error,exit:process.exit,exitCode:process.exitCode};
  process.argv=[process.execPath,fileURLToPath(import.meta.url),...args];
  process.exitCode=undefined;
  process.exit=code=>{throw new ExitSignal(code??process.exitCode??0);};
  console.log=(...parts)=>{stdout.push(parts.map(String).join(' '));};
  // runExtensionVerb reports a thrown error as JSON; the exit signal is not an error of the verb, so that line is dropped.
  console.error=(...parts)=>{if(String(parts[0]).includes(`"error":"${EXIT_MESSAGE}`))return;stderr.push(parts.map(String).join(' '));};
  try{
    const entry=new URL(API);
    entry.searchParams.set(tag,String(sequence));
    const {main}=await import(entry.href);
    await main();
    return {status:process.exitCode??0,stdout:`${stdout.join('\n')}\n`,stderr:stderr.length?`${stderr.join('\n')}\n`:''};
  }catch(error){
    const printed=lines=>`${lines.join('\n')}${lines.length?'\n':''}`;
    if(error instanceof ExitSignal)return {status:error.exitCode,stdout:printed(stdout),stderr:printed(stderr)};
    return {status:1,stdout:`${stdout.join('\n')}${stdout.length?'\n':''}`,
      stderr:`${stderr.join('\n')}${stderr.length?'\n':''}${error?.stack??error}\n`};
  }finally{
    process.argv=original.argv;
    process.exit=original.exit;
    process.exitCode=original.exitCode;
    console.log=original.log;
    console.error=original.error;
  }
};
