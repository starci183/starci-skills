import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const HERE=fileURLToPath(import.meta.url);
const API=new URL('../../scripts/kernel/cli.mjs',import.meta.url);
const pause=new Int32Array(new SharedArrayBuffer(4));
const sleep=ms=>Atomics.wait(pause,0,0,ms);
const waitFor=(file,timeout=120_000)=>{
  const until=Date.now()+timeout;
  while(!fs.existsSync(file)){
    if(Date.now()>=until)throw new Error(`peer-wait CLI fixture timed out waiting for ${path.basename(file)}`);
    sleep(2);
  }
};

const runEntry=async(args,sequence)=>{
  const stdout=[];
  const stderr=[];
  const original={argv:process.argv,log:console.log,error:console.error,exitCode:process.exitCode};
  let printed;
  const output=new Promise(resolve=>{printed=resolve;});
  process.argv=[process.execPath,fileURLToPath(API),...args];
  process.exitCode=undefined;
  console.log=(...parts)=>{stdout.push(parts.map(String).join(' '));printed();};
  console.error=(...parts)=>{stderr.push(parts.map(String).join(' '));};
  let outputTimer;
  try{
    const entry=new URL(API);
    entry.searchParams.set('peerWaitFixtureRun',String(sequence));
    await import(entry.href);
    await Promise.race([
      output,
      new Promise((_,reject)=>{outputTimer=setTimeout(()=>reject(new Error(`CLI produced no output: ${args.join(' ')}`)),120_000);}),
    ]);
    await new Promise(resolve=>setImmediate(resolve));
    return {status:process.exitCode??0,stdout:`${stdout.join('\n')}\n`,stderr:stderr.length?`${stderr.join('\n')}\n`:''};
  }catch(error){
    return {status:1,stdout:`${stdout.join('\n')}${stdout.length?'\n':''}`,stderr:`${stderr.join('\n')}${stderr.length?'\n':''}${error?.stack??error}\n`};
  }finally{
    clearTimeout(outputTimer);
    process.argv=original.argv;
    process.exitCode=original.exitCode;
    console.log=original.log;
    console.error=original.error;
  }
};

const serve=async root=>{
  fs.writeFileSync(path.join(root,'ready'),'ready');
  let running=true;
  while(running){
    const requests=fs.readdirSync(root).filter(name=>name.endsWith('.request.json')).sort();
    if(!requests.length){sleep(2);continue;}
    for(const name of requests){
      const requestFile=path.join(root,name);
      const request=JSON.parse(fs.readFileSync(requestFile,'utf8'));
      fs.rmSync(requestFile,{force:true});
      const response=request.shutdown?{status:0,stdout:'',stderr:''}:await runEntry(request.args,request.sequence);
      const responseFile=path.join(root,`${request.sequence}.response.json`);
      fs.writeFileSync(`${responseFile}.tmp`,JSON.stringify(response));
      fs.renameSync(`${responseFile}.tmp`,responseFile);
      if(request.shutdown){running=false;break;}
    }
  }
};

export const startPeerWaitCli=()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-peer-wait-cli-'));
  const child=spawn(process.execPath,[HERE,'--serve',root],{stdio:'ignore',windowsHide:true});
  waitFor(path.join(root,'ready'));
  let sequence=0;
  const request=payload=>{
    const id=++sequence;
    const requestFile=path.join(root,`${String(id).padStart(6,'0')}.request.json`);
    fs.writeFileSync(`${requestFile}.tmp`,JSON.stringify({...payload,sequence:id}));
    fs.renameSync(`${requestFile}.tmp`,requestFile);
    const responseFile=path.join(root,`${id}.response.json`);
    waitFor(responseFile);
    const response=JSON.parse(fs.readFileSync(responseFile,'utf8'));
    fs.rmSync(responseFile,{force:true});
    return response;
  };
  return {
    run:args=>request({args}),
    close:()=>{
      if(child.exitCode===null)request({shutdown:true});
      fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25});
    },
  };
};

if(process.argv[2]==='--serve')await serve(path.resolve(process.argv[3]));
