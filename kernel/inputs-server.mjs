import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {createInputModel,readInputState} from './inputs-model.mjs';
import {inputPage} from './inputs-ui.mjs';
import {createStore} from './store.mjs';

export const INPUT_BODY_LIMIT=128*1024;
const read=file=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}};
// `inputs.lock` is a ledger signal now (`inputs-lock`, scope the workflow id), never a file - these three
// remain the scratch IPC files under `os.tmpdir()/starci/<hash>/` (see kernel/inputs.mjs).
export const inputFiles=dir=>({session:path.join(dir,'inputs-session.json'),launch:path.join(dir,'inputs-launch.json'),
  server:path.join(dir,'inputs-server.json')});
export function privateJson(file,value){
  const temporary=`${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary,JSON.stringify(value),{mode:0o600});fs.renameSync(temporary,file);
}
export const processAlive=pid=>{if(!Number.isInteger(pid)||pid<1)return false;try{process.kill(pid,0);return true;}catch(error){return error.code==='EPERM';}};

/** Loopback capability server; no HTTP credential value is ever logged, reflected or written to a file. */
export async function startInputServer({token,model,language='vi',port=0,sessionId='test'}={}){
  if(typeof token!=='string'||token.length<32)throw Error('An input session requires a capability.');
  const nonce=crypto.randomBytes(24).toString('base64url');
  const server=http.createServer(async(request,response)=>{
    const origin=`http://127.0.0.1:${server.address().port}`;
    response.setHeader('Cache-Control','no-store');response.setHeader('Pragma','no-cache');
    response.setHeader('X-Content-Type-Options','nosniff');response.setHeader('Referrer-Policy','no-referrer');
    response.setHeader('Content-Security-Policy',`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`);
    const send=(status,value)=>{if(response.destroyed)return;response.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});response.end(JSON.stringify(value));};
    const auth=Buffer.from(request.headers.authorization??''),expected=Buffer.from(`Bearer ${token}`);
    const authorized=auth.length===expected.length&&crypto.timingSafeEqual(auth,expected);
    if(request.headers.host!==`127.0.0.1:${server.address().port}`||request.headers.origin&&request.headers.origin!==origin
      ||request.headers['sec-fetch-site']==='cross-site')return send(403,{ok:false,code:'forbidden'});
    if(request.method==='GET'&&request.url===`/inputs/${sessionId}`){
      response.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});response.end(inputPage({nonce,language}));return;
    }
    if(!authorized)return send(403,{ok:false,code:'forbidden'});
    if(request.method==='GET'&&request.url==='/status'){
      try{return send(200,model.snapshot());}catch{return send(503,{ok:false,code:'workflow-unavailable'});}
    }
    if(request.method!=='POST'||!['/credentials','/owner-actions'].includes(request.url))return send(405,{ok:false,code:'method-not-allowed'});
    if(request.headers.origin!==origin||request.headers['content-type']?.split(';')[0]!=='application/json')return send(403,{ok:false,code:'forbidden'});
    if(Number(request.headers['content-length'])>INPUT_BODY_LIMIT)return send(413,{ok:false,code:'request-too-large'});
    let body='',size=0;
    try{
      request.setEncoding('utf8');
      for await(const chunk of request){size+=Buffer.byteLength(chunk);if(size>INPUT_BODY_LIMIT){send(413,{ok:false,code:'request-too-large'});return;}body+=chunk;}
      let input;try{input=JSON.parse(body);}catch{return send(400,{ok:false,code:'invalid-request'});}finally{body='';}
      const result=request.url==='/owner-actions'?await model.submitOwnerAction(input):await model.submit(input);
      send(result.code==='invalid-request'?400:result.code==='request-changed'?409:200,result);
    }catch{send(503,{ok:false,code:'storage-unavailable'});}
  });
  server.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=1000;
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  const origin=`http://127.0.0.1:${server.address().port}`;
  return {server,origin,url:`${origin}/inputs/${sessionId}#${token}`,close:()=>new Promise(resolve=>{server.close(resolve);server.closeIdleConnections();})};
}

/**
 * Detached helper for the public workflow-inputs command. Only helper sidecars and custody are writable.
 *
 * The helper is a worker of the kernel like any other: it never opens `.starciwork/runtime.sqlite` for
 * writes beyond the one signal it owns. `inputs-lock` (the mutex a second accidental spawn must respect)
 * and `kernel-lock` (whether the owning kernel is still alive) are both rows of the ledger's `signals`
 * table; a store is opened here only to read and hold them, closed on the way out.
 */
export async function serveWorkflowInputs(sessionFile,{now=Date.now,alive=processAlive,graceMs=120000,intervalMs=2000}={}){
  const session=read(sessionFile);
  if(session?.schema!=='starci/input-session@1'||!session?.binding?.repoRoot||!session.id)throw Error('Invalid workflow input session.');
  // The session file's own directory IS the scratch root the kernel created it under (os.tmpdir()/starci/<id>/);
  // the binding itself carries no directory any more, only the ledger's repoRoot.
  const files=inputFiles(path.dirname(path.resolve(sessionFile)));
  if(path.resolve(sessionFile)!==files.session||!readInputState(session.binding))throw Error('Workflow input binding is unavailable.');
  let store;
  try{store=createStore({repoRoot:session.binding.repoRoot,id:session.binding.id});}
  catch{throw Error('Workflow input binding is unavailable.');}
  // `signal.set` replaces unconditionally, so exclusivity is a read-then-write in application code: a live
  // holder refuses the second spawn, and a dead one's row is simply overwritten by the one that wins the race.
  const holder=store.signal.get(session.binding.id,'inputs-lock');
  if(holder&&alive(holder.pid)){store.close();throw Error('A workflow input helper already owns this workflow.');}
  store.signal.set(session.binding.id,'inputs-lock',{pid:process.pid,value:{session:session.id}});
  let app=null,timer=null,goneAt=null;
  const removeOwned=()=>{if(store.signal.get(session.binding.id,'inputs-lock')?.pid===process.pid)store.signal.clear(session.binding.id,'inputs-lock');};
  try{
    if(read(files.session)?.id!==session.id)throw Error('Workflow input session was replaced before startup.');
    const model=createInputModel({binding:session.binding});
    app=await startInputServer({token:session.token,model,language:session.language,sessionId:session.id,port:session.port??0});
    privateJson(files.server,{schema:'starci/input-server@1',session:session.id,pid:process.pid,port:app.server.address().port,startedAt:now()});
    await new Promise(resolve=>{
      const stop=()=>{clearInterval(timer);app.server.close(()=>resolve());app.server.closeIdleConnections();};
      process.once('SIGTERM',stop);process.once('SIGINT',stop);
      timer=setInterval(()=>{
        const state=readInputState(session.binding),kernel=store.signal.get(session.binding.id,'kernel-lock');
        const noOwner=!state||Boolean(state.finished)||!alive(kernel?.pid);
        const current=read(files.session);
        if(current?.id!==session.id||current.retire){stop();return;}
        if(noOwner){goneAt??=now();if(now()-goneAt>=graceMs)stop();}else goneAt=null;
      },intervalMs);
    });
  }finally{clearInterval(timer);removeOwned();store.close();}
  return {ok:true,workflow:session.binding.id,closed:true};
}
