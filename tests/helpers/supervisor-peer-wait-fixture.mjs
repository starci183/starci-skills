import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {runKernelCliEntry} from './kernel-cli-entry.mjs';

const HERE=fileURLToPath(import.meta.url);
const pause=new Int32Array(new SharedArrayBuffer(4));
const sleep=ms=>Atomics.wait(pause,0,0,ms);
const waitFor=(file,timeout=120_000,alive=()=>true)=>{
  const until=Date.now()+timeout;
  while(!fs.existsSync(file)){
    if(!alive())throw new Error(`peer-wait CLI fixture exited before writing ${path.basename(file)}`);
    if(Date.now()>=until)throw new Error(`peer-wait CLI fixture timed out waiting for ${path.basename(file)}`);
    sleep(2);
  }
};

const runEntry=(args,sequence)=>runKernelCliEntry({args,tag:'peerWaitFixtureRun',sequence});

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
    waitFor(responseFile,120_000,()=>child.exitCode===null);
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
