import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {runKernelCliEntry,withEnv} from './kernel-cli-entry.mjs';

const HERE=fileURLToPath(import.meta.url);
const ROOT=fileURLToPath(new URL('../..',import.meta.url));
const pause=new Int32Array(new SharedArrayBuffer(4));
const sleep=ms=>Atomics.wait(pause,0,0,ms);
const waitFor=(file,timeout=120_000,alive=()=>true)=>{
  const until=Date.now()+timeout;
  while(!fs.existsSync(file)){
    if(!alive())return false;
    if(Date.now()>=until)throw new Error(`kernel-api CLI fixture timed out waiting for ${path.basename(file)}`);
    sleep(2);
  }
  return true;
};

const runEntry=({args,env,sequence})=>withEnv(env,()=>runKernelCliEntry({args,tag:'kernelApiFixtureRun',sequence}));

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
      const response=request.shutdown?{status:0,stdout:'',stderr:''}:await runEntry(request);
      const responseFile=path.join(root,`${request.sequence}.response.json`);
      fs.writeFileSync(`${responseFile}.tmp`,JSON.stringify(response));
      fs.renameSync(`${responseFile}.tmp`,responseFile);
      if(request.shutdown){running=false;break;}
    }
  }
};

export const startKernelApiCli=()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-kernel-api-cli-'));
  const child=spawn(process.execPath,[HERE,'--serve',root],{cwd:ROOT,stdio:'ignore',windowsHide:true});
  waitFor(path.join(root,'ready'));
  const alive=()=>{try{process.kill(child.pid,0);return true;}catch{return false;}};
  let sequence=0;
  const request=payload=>{
    const id=++sequence;
    const requestFile=path.join(root,`${String(id).padStart(6,'0')}.request.json`);
    fs.writeFileSync(`${requestFile}.tmp`,JSON.stringify({...payload,sequence:id}));
    fs.renameSync(`${requestFile}.tmp`,requestFile);
    const responseFile=path.join(root,`${id}.response.json`);
    if(!waitFor(responseFile,120_000,alive))return {status:1,stdout:'',stderr:'CLI fixture process exited before responding\n'};
    const response=JSON.parse(fs.readFileSync(responseFile,'utf8'));
    fs.rmSync(responseFile,{force:true});
    return response;
  };
  return {
    run:(args,env={})=>request({args,env}),
    close:()=>{
      if(alive())request({shutdown:true});
      fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25});
    },
  };
};

if(process.argv[2]==='--serve')await serve(path.resolve(process.argv[3]));
