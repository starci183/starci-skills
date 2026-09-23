import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {withLedger,seedWorkflow} from './_ledger-fixture.mjs';
import {connectorsConfig,connectorSecret,readDotenv,validateConfig,CONNECTOR_DEFAULTS} from '../engine/config.mjs';
import {parseYaml} from '../engine/yaml.mjs';
import {servingAsks,askRepos} from '../scripts/connectors/lib.mjs';
import {createGateway,ledgerResolver} from '../scripts/connectors/ask-gateway.mjs';
import {parseQuickTunnelUrl,parseConnected,cloudflaredPlan,cloudflaredConfigText,superviseTunnel,tunnelState} from '../scripts/connectors/tunnel.mjs';
import {notifyAsk,markAskClosed,sendMessage,redact,discoverChats} from '../scripts/connectors/telegram.mjs';

// scripts/connectors/* publish serve-ask forms through one gateway + one Cloudflare tunnel and tell the
// owner on Telegram (docs/connectors.md). Every spec here runs on fakes: no network, no cloudflared.

const EXAMPLE=parseYaml(fs.readFileSync(new URL('../config.example.yaml',import.meta.url),'utf8'));
const withConnectors=connectors=>({...structuredClone(EXAMPLE),connectors});
const TOKEN='123456789:AAFakeTokenForSpecsOnly_abcdefghijklmnop';
const tmp=(t,prefix)=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),prefix));t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));return dir;};
const listen=async(t,server)=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.closeAllConnections?.();server.close(()=>resolve());}));return server.address().port;};
const request=(port,{method='GET',path:p='/',body=null,headers={}}={})=>new Promise((resolve,reject)=>{
  const req=http.request({host:'127.0.0.1',port,method,path:p,headers:{...(body?{'content-type':'application/x-www-form-urlencoded','content-length':Buffer.byteLength(body)}:{}),...headers}},res=>{
    let data='';res.setEncoding('utf8');res.on('data',c=>{data+=c;});res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:data}));
  });
  req.on('error',reject);if(body)req.write(body);req.end();
});
const until=async(fn,ms=8000)=>{const end=Date.now()+ms;for(;;){const v=fn();if(v)return v;if(Date.now()>end)throw Error('timed out');await new Promise(r=>setTimeout(r,50));}};

/* ------------------------------------------------------------- config */

test('connectors ship off, normalize with defaults, and report secret presence as a boolean only',()=>{
  assert.equal(validateConfig(EXAMPLE),EXAMPLE,'the shipped example validates');
  const c=connectorsConfig({...EXAMPLE,connectors:{...EXAMPLE.connectors,secretsFile:null}},{});
  assert.equal(c.cloudflare.mode,'off');
  assert.equal(c.telegram.enabled,false);
  assert.equal(c.telegram.configured,false);
  assert.equal(c.telegram.exposeCredentialAsks,false);
  assert.equal(c.gateway.port,CONNECTOR_DEFAULTS.gateway.port);
  const noBlock=structuredClone(EXAMPLE);delete noBlock.connectors;
  assert.equal(connectorsConfig(noBlock,{}).cloudflare.mode,'off','an absent block is all defaults');
  const on=connectorsConfig(withConnectors({telegram:{enabled:true,chatId:-1001234567890,botTokenEnv:'MY_BOT'}}),{MY_BOT:TOKEN});
  assert.equal(on.telegram.botTokenPresent,true);
  assert.equal(on.telegram.configured,true);
  assert.equal(on.telegram.chatId,'-1001234567890','a numeric chat id normalizes to its string');
  assert.ok(!JSON.stringify(on).includes(TOKEN),'the normalized config never carries the secret');
});

test('connectors validation fails closed on secrets, unknown keys and inconsistent modes',()=>{
  const refused=[
    [{cloudflare:{mode:'named',hostname:'ask.example.org',tokenEnv:'eyJhIjoiNGQ2ZTQ4ZjEifQ'}},/tokenEnv must name an environment variable/],
    [{telegram:{botTokenEnv:TOKEN}},/botTokenEnv must name an environment variable/],
    [{telegram:{token:TOKEN}},/secrets never live in config\.yaml/],
    [{cloudflare:{tunnelToken:'x'}},/secrets never live in config\.yaml/],
    [{cloudflare:{mode:'on'}},/mode must be one of off \| quick \| named/],
    [{cloudflare:{mode:'named'}},/named needs cloudflare\.hostname/],
    [{cloudflare:{mode:'quick',hostname:'ask.example.org'}},/quick gets a random/],
    [{cloudflare:{mode:'named',hostname:'ask.example.org',credentialsFile:'c.json'}},/credentialsFile needs cloudflare\.tunnel/],
    [{cloudflare:{mode:'named',hostname:'https://ask.example.org/x'}},/bare hostname/],
    [{gateway:{port:6999}},/outside the serve-ask band/],
    [{telegram:{enabled:true}},/enabled needs telegram\.chatId/],
    [{telegram:{notify:['ask-serving']}},/unknown key notify/],
    [{telegram:{exposeCredentialAsks:'yes'}},/exposeCredentialAsks must be true or false/],
    [{slack:{}},/unknown key slack/],
    ['on',/connectors must be/],
  ];
  for(const [connectors,pattern] of refused)assert.throws(()=>validateConfig(withConnectors(connectors)),pattern,JSON.stringify(connectors));
  for(const connectors of [null,{},{cloudflare:{mode:'quick'}},{cloudflare:{mode:'named',hostname:'ask.example.org',tunnel:'21e1ba7c-9bef-4154-b59a-0151f4efd9db',credentialsFile:'~/.cloudflared/x.json',access:true}},
    {telegram:{enabled:true,chatId:'@starci_owner'}}])
    assert.doesNotThrow(()=>validateConfig(withConnectors(connectors)),JSON.stringify(connectors));
});

test('secrets resolve from the env var, its _FILE pointer or connectors.secretsFile, and a real env var wins',t=>{
  const root=tmp(t,'starci-connectors-secrets-');
  fs.mkdirSync(path.join(root,'.secrets'));
  fs.writeFileSync(path.join(root,'.secrets','connectors.env'),`# owner secrets\nTELEGRAM_BOT_TOKEN="${TOKEN}"\nexport CLOUDFLARE_TUNNEL_TOKEN=from-file\n`);
  assert.deepEqual(readDotenv(path.join(root,'.secrets','connectors.env')),{TELEGRAM_BOT_TOKEN:TOKEN,CLOUDFLARE_TUNNEL_TOKEN:'from-file'});
  const config=withConnectors({secretsFile:'.secrets/connectors.env',telegram:{enabled:true,chatId:'42'}});
  const c=connectorsConfig(config,{},root);
  assert.equal(c.telegram.botTokenPresent,true);
  assert.equal(c.cloudflare.tokenPresent,true);
  assert.ok(!JSON.stringify(c).includes(TOKEN));
  const pointer=path.join(root,'custody.key');fs.writeFileSync(pointer,'custody-value\n');
  assert.equal(connectorSecret('X_TOKEN',{X_TOKEN_FILE:pointer}),'custody-value');
  assert.equal(connectorSecret('X_TOKEN',{X_TOKEN:'direct',X_TOKEN_FILE:pointer}),'direct');
  assert.equal(connectorSecret('X_TOKEN',{}),null);
  assert.equal(connectorsConfig(withConnectors({secretsFile:'.secrets/missing.env'}),{},root).telegram.botTokenPresent,false,'an absent secrets file is no values');
});

/* ------------------------------------------------------------- gateway */

const NONCE='a-0123456789abcdef01',CRED='a-fedcba98765432100f';
const fakeForm=async t=>{
  const seen=[];
  const server=http.createServer((req,res)=>{
    let body='';req.on('data',c=>{body+=c;});
    req.on('end',()=>{
      seen.push({method:req.method,url:req.url,body,host:req.headers.host});
      const port=server.address().port;
      if(req.method==='GET'&&(req.url===`/${NONCE}`||req.url===`/${CRED}`)){res.writeHead(200,{'content-type':'text/html'});res.end(`<form method="post" action="${req.url}/answer">form</form>`);return;}
      if(req.method==='GET'&&req.url===`/${NONCE}/img/0`){res.writeHead(200,{'content-type':'image/png'});res.end('PNG');return;}
      if(req.method==='POST'&&req.url===`/${NONCE}/answer`){res.writeHead(200,{'content-type':'text/plain'});res.end(`got ${body}`);return;}
      if(req.url===`/${NONCE}/go?x=1`){res.writeHead(302,{location:`http://127.0.0.1:${port}/${NONCE}/done?y=2`});res.end();return;}
      res.writeHead(404);res.end('form 404');
    });
  });
  const port=await listen(t,server);
  return {port,seen,url:n=>`http://127.0.0.1:${port}/${n}`};
};

test('the gateway proxies a served nonce (page, asset, POST, redirect) and forwards nothing else',async t=>{
  const form=await fakeForm(t);
  let expose=false;
  const asks={[NONCE]:{url:form.url(NONCE),credential:false},[CRED]:{url:form.url(CRED),credential:true}};
  const gw=await listen(t,createGateway({resolve:n=>asks[n]??null,exposeCredentialAsks:()=>expose,language:()=>'vi'}));

  const page=await request(gw,{path:`/${NONCE}`});
  assert.equal(page.status,200);
  assert.match(page.body,/<form method="post" action="\/a-0123456789abcdef01\/answer">/);
  assert.equal(page.headers['referrer-policy'],'no-referrer','the bearer URL never leaks through Referer');
  assert.equal(page.headers['cache-control'],'no-store');
  assert.equal(form.seen.at(-1).host,`127.0.0.1:${form.port}`,'the form sees its own loopback host');

  const img=await request(gw,{path:`/${NONCE}/img/0`});
  assert.equal(img.status,200);assert.equal(img.body,'PNG');assert.equal(img.headers['content-type'],'image/png');

  const post=await request(gw,{method:'POST',path:`/${NONCE}/answer`,body:'option=1&note=ok'});
  assert.equal(post.status,200);assert.equal(post.body,'got option=1&note=ok');

  const redirect=await request(gw,{path:`/${NONCE}/go?x=1`});
  assert.equal(redirect.status,302);
  assert.equal(redirect.headers.location,`/${NONCE}/done?y=2`,'a redirect to the loopback origin becomes a public path');

  const before=form.seen.length;
  for(const p of ['/','/favicon.ico','/a-notanonce',`/a-1111111111111111ff`,`/${NONCE}x`,`/${NONCE}/../${CRED}`,'/.well-known/x','/a-0123456789ABCDEF01']){
    const r=await request(gw,{path:p});
    assert.equal(r.status,404,p);
  }
  assert.equal((await request(gw,{method:'DELETE',path:`/${NONCE}`})).status,405);
  assert.equal(form.seen.length,before,'an unknown path is refused without reaching any form');

  const cred=await request(gw,{path:`/${CRED}`});
  assert.equal(cred.status,403,'a credential ask stays off the public link by default');
  assert.match(cred.body,/thông tin bí mật/,'the refusal speaks config language');
  assert.equal(form.seen.length,before,'the refused credential form was never contacted');
  expose=true;
  assert.equal((await request(gw,{path:`/${CRED}`})).status,200,'exposeCredentialAsks opts the credential form in');

  const probe=http.createServer();
  await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
  const deadPort=probe.address().port;
  await new Promise(resolve=>probe.close(resolve));
  const gone=await listen(t,createGateway({resolve:()=>({url:`http://127.0.0.1:${deadPort}/${NONCE}`,credential:false})}));
  assert.equal((await request(gone,{path:`/${NONCE}`})).status,502,'a form that stopped answering is a 502, not a hang');
});

const seedServing=(ledger,{workflowId,dispatchId,url,fields={files:[],vars:[]},question,title=null,extra=[]})=>{
  seedWorkflow(ledger,{id:workflowId,state:{phase:'running',job:title}});
  ledger.db.prepare(`INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,created_at) VALUES(?,?,?,?,?,?,?,?)`)
    .run(workflowId,dispatchId,'provision.ask',1,1,'ask',JSON.stringify({schema:'starci/op-report@1',outcome:'ask',question}),Date.now());
  ledger.appendEvent({workflowId,entityType:'report',entityId:dispatchId,kind:'ask-serving',payload:{dispatchId,url,pid:process.pid,fields,ttlMs:4*60*60*1000}});
  for(const kind of extra)ledger.appendEvent({workflowId,entityType:'report',entityId:dispatchId,kind,payload:{dispatchId}});
};

test('the ledger resolver finds an open ask by nonce and drops it once answered, expired or non-loopback',t=>{
  withLedger(t,({ledger,repoRoot})=>{
    seedServing(ledger,{workflowId:'wf-open',dispatchId:'ctx_open',url:`http://127.0.0.1:6970/${NONCE}`,question:{text:'q'}});
    seedServing(ledger,{workflowId:'wf-done',dispatchId:'ctx_done',url:'http://127.0.0.1:6971/a-aaaaaaaaaaaaaaaaaa',question:{text:'q'},extra:['ask-answered']});
    seedServing(ledger,{workflowId:'wf-exp',dispatchId:'ctx_exp',url:'http://127.0.0.1:6972/a-bbbbbbbbbbbbbbbbbb',question:{text:'q'},extra:['ask-serving-expired']});
    seedServing(ledger,{workflowId:'wf-far',dispatchId:'ctx_far',url:'http://10.0.0.5:6973/a-cccccccccccccccccc',question:{text:'q'}});
    seedServing(ledger,{workflowId:'wf-cred',dispatchId:'ctx_cred',url:`http://127.0.0.1:6974/${CRED}`,fields:{files:['vnpay.key'],vars:[]},question:{text:'q'}});
    const open=servingAsks(ledger.db);
    assert.deepEqual(open.map(a=>a.dispatchId).sort(),['ctx_cred','ctx_open']);
    assert.equal(open.find(a=>a.dispatchId==='ctx_cred').credential,true);
    const resolve=ledgerResolver({repos:()=>[repoRoot]});
    assert.equal(resolve(NONCE).url,`http://127.0.0.1:6970/${NONCE}`);
    assert.equal(resolve('a-aaaaaaaaaaaaaaaaaa'),null);
    assert.equal(resolve('a-cccccccccccccccccc'),null,'a non-loopback form url is never a proxy target');
    assert.deepEqual(askRepos({repos:[repoRoot]},{env:{}}),[repoRoot],'a listed repo with a ledger is read');
    assert.deepEqual(askRepos({repos:[path.join(repoRoot,'nope')]},{env:{}}),[],'a repo without a ledger is skipped');
  });
});

/* -------------------------------------------------------------- tunnel */

const QUICK_OUTPUT=`2026-09-23T03:12:01Z INF Thank you for trying Cloudflare Tunnel. Doing so, without a Cloudflare account, is a quick way to experiment and try it out.
2026-09-23T03:12:01Z INF Requesting new quick Tunnel on trycloudflare.com...
2026-09-23T03:12:03Z INF +--------------------------------------------------------------------------------------------+
2026-09-23T03:12:03Z INF |  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
2026-09-23T03:12:03Z INF |  https://violet-harbor-quiet-lemon.trycloudflare.com                                       |
2026-09-23T03:12:03Z INF +--------------------------------------------------------------------------------------------+
2026-09-23T03:12:04Z INF Registered tunnel connection connIndex=0 connection=3f1c2b9e-0000-4000-8000-000000000000 event=0 ip=198.41.200.13 location=sin01 protocol=quic
`;

test('the quick tunnel URL and the connection registration parse from cloudflared output',()=>{
  assert.equal(parseQuickTunnelUrl(QUICK_OUTPUT),'https://violet-harbor-quiet-lemon.trycloudflare.com');
  assert.equal(parseConnected(QUICK_OUTPUT),true);
  assert.equal(parseQuickTunnelUrl('ERR failed to request quick Tunnel: Post "https://api.trycloudflare.com/tunnel": dial tcp: i/o timeout'),null,'the API host is not a tunnel URL');
  assert.equal(parseQuickTunnelUrl('INF Starting tunnel tunnelID=21e1ba7c'),null);
  assert.equal(parseConnected('INF Starting metrics server on 127.0.0.1:20241/metrics'),false);
});

test('cloudflared always runs on a generated config; a named token rides the child env, never argv',()=>{
  const configFile='C:/state/connectors/cloudflared.yml';
  const named={mode:'named',auth:'credentials-file',tunnel:'21e1ba7c-9bef-4154-b59a-0151f4efd9db',credentialsFile:'C:\\Users\\o\\.cloudflared\\21e1.json',hostname:'response.example.org'};
  const plan=cloudflaredPlan(named,{port:7070,configFile,env:{}});
  assert.deepEqual(plan.args,['tunnel','--config',configFile,'--no-autoupdate','run','21e1ba7c-9bef-4154-b59a-0151f4efd9db']);
  const text=cloudflaredConfigText(named,7070),doc=parseYaml(text);
  assert.equal(doc.tunnel,named.tunnel);
  assert.equal(doc['credentials-file'],named.credentialsFile,'a Windows path survives YAML quoting');
  assert.deepEqual(doc.ingress,[{hostname:'response.example.org',service:'http://127.0.0.1:7070'},{service:'http_status:404'}],'the hostname maps to the gateway, everything else 404s');
  const quick=cloudflaredPlan({mode:'quick'},{port:7070,configFile,env:{STARCI_CLOUDFLARED_COMMAND:'node',STARCI_CLOUDFLARED_ARGS:'["fake.mjs"]'}});
  assert.equal(quick.command,'node');
  assert.deepEqual(quick.args,['fake.mjs','tunnel','--config',configFile,'--no-autoupdate','--url','http://127.0.0.1:7070']);
  const token=cloudflaredPlan({mode:'named',auth:'token',tokenEnv:'CF_TOKEN',hostname:'response.example.org'},{port:7070,configFile,env:{},secretEnv:{CF_TOKEN:'tok-secret'}});
  assert.equal(token.env.TUNNEL_TOKEN,'tok-secret');
  assert.ok(!token.args.join(' ').includes('tok-secret'),'the token is never on argv');
  assert.throws(()=>cloudflaredPlan({mode:'named',auth:'token',tokenEnv:'CF_TOKEN',hostname:'h.example.org'},{port:7070,configFile,env:{}}),/needs the tunnel token in CF_TOKEN/);
  assert.throws(()=>cloudflaredPlan({mode:'off'},{port:7070,configFile,env:{}}),/no tunnel to run/);
});

test('the tunnel manager records the quick URL and restarts a cloudflared that dies',async t=>{
  const home=tmp(t,'starci-connectors-tunnel-');
  const fake=path.join(home,'fake-cloudflared.mjs');
  fs.writeFileSync(fake,`const out=${JSON.stringify(QUICK_OUTPUT)};const argv=process.argv.slice(2);
if(!argv.includes('--config'))process.exit(9);
process.stderr.write(out);const die=process.env.FAKE_DIE==='1';setTimeout(()=>process.exit(die?3:0),die?150:60000);`);
  const env={...process.env,LOCALAPPDATA:home,STARCI_CLOUDFLARED_COMMAND:process.execPath,STARCI_CLOUDFLARED_ARGS:JSON.stringify([fake]),STARCI_TUNNEL_BACKOFF_MS:'50',FAKE_DIE:'1'};
  const handle=superviseTunnel({mode:'quick'},{port:7070,env});
  t.after(()=>handle.stop());
  const state=await until(()=>{const s=tunnelState(env);return s?.restarts>=2&&s.baseUrl?s:null;});
  assert.equal(state.baseUrl,'https://violet-harbor-quiet-lemon.trycloudflare.com');
  assert.equal(state.mode,'quick');
  assert.equal(state.lastExit.code,3,'the dead child exit is recorded');
  assert.ok(fs.readFileSync(path.join(home,'StarCi','runtime','connectors','cloudflared.yml'),'utf8').startsWith('# Generated by StarCi'));
  handle.stop();
  assert.equal(tunnelState(env).childPid,null);
});

/* ------------------------------------------------------------ telegram */

const fakeBot=({status=200,json={ok:true,result:{message_id:1}},sequence=null}={})=>{
  const calls=[];let id=100;
  const fetchImpl=async(url,init)=>{
    calls.push({url,method:url.split('/').pop(),body:init?.body?JSON.parse(init.body):null});
    const next=sequence?sequence[Math.min(calls.length-1,sequence.length-1)]:{status,json:json.result?.message_id?{...json,result:{...json.result,message_id:++id}}:json};
    return {ok:next.status>=200&&next.status<300,status:next.status,json:async()=>next.json};
  };
  return {calls,fetchImpl,sends:()=>calls.filter(c=>c.method==='sendMessage')};
};
const telegramConfig=(extra={})=>withConnectors({secretsFile:null,cloudflare:{mode:'named',hostname:'response.example.org'},telegram:{enabled:true,chatId:'4242',...extra}});
const DECISION={text:'Chốt giá gói Pro?',options:['99.000đ/tháng','Để sau']};
const deps=(machineHome,extra={})=>({config:telegramConfig(),env:{LOCALAPPDATA:machineHome,TELEGRAM_BOT_TOKEN:TOKEN},apiBase:'http://bot.invalid',sleepImpl:async()=>{},warn:()=>{},...extra});

test('serve-ask binding notifies once: workflow, question, numbered options and the public gateway link, in config language',async t=>{
  await withLedger(t,async({ledger,ledgerFile,machineHome})=>{
    seedServing(ledger,{workflowId:'wf-miamia-pricing-x1',dispatchId:'ctx_price',url:`http://127.0.0.1:6973/${NONCE}`,title:'miamia-pricing',question:DECISION});
    const bot=fakeBot(),warnings=[];
    const logs=[];const saved={log:console.log,error:console.error,warn:console.warn};
    console.log=console.error=console.warn=(...a)=>logs.push(a.join(' '));
    let first,second;
    try{
      first=await notifyAsk({ledgerFile,workflowId:'wf-miamia-pricing-x1',dispatchId:'ctx_price'},deps(machineHome,{fetchImpl:bot.fetchImpl,warn:w=>warnings.push(w)}));
      second=await notifyAsk({ledgerFile,workflowId:'wf-miamia-pricing-x1',dispatchId:'ctx_price'},deps(machineHome,{fetchImpl:bot.fetchImpl,warn:w=>warnings.push(w)}));
    }finally{Object.assign(console,saved);}
    assert.equal(first.sent,1);assert.equal(first.ok,true);
    assert.equal(second.skipped,'already sent','the same ask-serving event is never sent twice');
    assert.equal(bot.calls.length,1);
    const [call]=bot.calls;
    assert.equal(call.url,`http://bot.invalid/bot${TOKEN}/sendMessage`);
    assert.equal(call.body.chat_id,'4242');
    assert.equal(call.body.link_preview_options?.is_disabled,true,'no link preview fetches the bearer URL');
    const text=call.body.text;
    assert.match(text,/^\[StarCi\] Có câu hỏi cần thầy trả lời\nWorkflow: miamia-pricing \(wf-miamia-pricing-x1\)\n\nCâu hỏi:\nChốt giá gói Pro\?/);
    assert.match(text,/Lựa chọn:\n1\. 99\.000đ\/tháng\n2\. Để sau/);
    assert.match(text,new RegExp(`Trả lời tại: https://response\\.example\\.org/${NONCE}`),'the link is the form on the public gateway host');
    assert.ok(!text.includes('127.0.0.1'),'a decision ask carries no localhost link');
    assert.deepEqual(warnings,[]);
    const out=JSON.stringify([first,second])+logs.join('\n')+fs.readFileSync(path.join(machineHome,'StarCi','runtime','connectors','telegram-sent.json'),'utf8');
    assert.ok(!out.includes(TOKEN)&&!out.includes('AAFakeToken'),'the token never reaches output, logs or state');
  });
});

test('a re-served ask sends its new link and points the earlier message at it',async t=>{
  await withLedger(t,async({ledger,ledgerFile,machineHome})=>{
    seedServing(ledger,{workflowId:'wf-a',dispatchId:'ctx_a',url:`http://127.0.0.1:6973/${NONCE}`,question:DECISION});
    const bot=fakeBot();
    const first=await notifyAsk({ledgerFile,workflowId:'wf-a',dispatchId:'ctx_a'},deps(machineHome,{fetchImpl:bot.fetchImpl}));
    ledger.appendEvent({workflowId:'wf-a',entityType:'report',entityId:'ctx_a',kind:'ask-serving-expired',payload:{dispatchId:'ctx_a'}});
    ledger.appendEvent({workflowId:'wf-a',entityType:'report',entityId:'ctx_a',kind:'ask-serving',payload:{dispatchId:'ctx_a',url:'http://127.0.0.1:6980/a-99999999999999999f',pid:1,fields:{files:[],vars:[]},ttlMs:3600000}});
    const again=await notifyAsk({ledgerFile,workflowId:'wf-a',dispatchId:'ctx_a'},deps(machineHome,{fetchImpl:bot.fetchImpl}));
    assert.equal(again.sent,1);assert.equal(again.reserve,true);
    const sends=bot.sends();
    assert.equal(sends.length,2);
    assert.match(sends[1].body.text,/^\[StarCi\] Link mới \(thay link cũ\)/);
    assert.match(sends[1].body.text,/Trả lời tại: https:\/\/response\.example\.org\/a-99999999999999999f/);
    const edit=bot.calls.find(c=>c.method==='editMessageText');
    assert.equal(edit?.body.message_id,first.messageId,'the earlier message is edited, not left pointing at a dead link');
    assert.match(edit.body.text,/đã được thay bằng link mới/);
  });
});

test('a credential ask says to answer on the machine and gets the public link only when exposeCredentialAsks is on',async t=>{
  await withLedger(t,async({ledger,ledgerFile,machineHome})=>{
    seedServing(ledger,{workflowId:'wf-nivo-pay-x2',dispatchId:'ctx_vnpay',url:`http://127.0.0.1:6974/${CRED}`,fields:{files:['vnpay-hash-secret.key'],vars:['VNPAY_TMN_CODE']},
      question:{text:'Nhập VNPAY_TMN_CODE và vnpay-hash-secret.key',options:[]}});
    const local=fakeBot();
    await notifyAsk({ledgerFile,workflowId:'wf-nivo-pay-x2',dispatchId:'ctx_vnpay'},deps(machineHome,{fetchImpl:local.fetchImpl}));
    const text=local.calls[0].body.text;
    assert.match(text,/Nhập VNPAY_TMN_CODE/,'the question is still sent');
    assert.match(text,/nên form không được đưa ra ngoài; trả lời trên máy/);
    assert.ok(!text.includes('127.0.0.1'),'a localhost link is useless off the machine and is never sent');
    assert.ok(!text.includes('response.example.org'),'no public link for a credential ask by default');
    const exposed=fakeBot();
    await notifyAsk({ledgerFile,workflowId:'wf-nivo-pay-x2',dispatchId:'ctx_vnpay'},
      deps(path.join(machineHome,'exposed'),{fetchImpl:exposed.fetchImpl,config:telegramConfig({exposeCredentialAsks:true})}));
    assert.ok(exposed.calls[0].body.text.includes(`https://response.example.org/${CRED}`),'exposeCredentialAsks opts the public link in');
  });
});

test('the notifier never throws into serve-ask: off, incomplete, answered, failing and spec runs are quiet no-ops',async t=>{
  await withLedger(t,async({ledger,ledgerFile,machineHome})=>{
    seedServing(ledger,{workflowId:'wf-a',dispatchId:'ctx_a',url:`http://127.0.0.1:6973/${NONCE}`,question:DECISION});
    const bot=fakeBot(),ask={ledgerFile,workflowId:'wf-a',dispatchId:'ctx_a'};
    const warned=[],warn=w=>warned.push(w);
    const off=await notifyAsk(ask,deps(machineHome,{fetchImpl:bot.fetchImpl,warn,config:withConnectors({secretsFile:null}),env:{LOCALAPPDATA:machineHome}}));
    assert.equal(off.skipped,'telegram off');assert.deepEqual(warned,[],'Telegram that is simply off says nothing');
    const noChat=await notifyAsk(ask,deps(machineHome,{fetchImpl:bot.fetchImpl,warn,config:withConnectors({secretsFile:null})}));
    assert.equal(noChat.ok,true);
    assert.equal(warned.length,1,'a token without a chat id is one warning line');
    assert.match(warned[0],/missing connectors\.telegram\.chatId/);
    const noToken=await notifyAsk(ask,deps(machineHome,{fetchImpl:bot.fetchImpl,warn,env:{LOCALAPPDATA:machineHome}}));
    assert.equal(noToken.ok,true);assert.match(warned[1],/missing the bot token \(TELEGRAM_BOT_TOKEN\)/);
    assert.ok(!warned.join('\n').includes(TOKEN));
    assert.equal(bot.calls.length,0);
    const real=await notifyAsk(ask,{...deps(machineHome),apiBase:undefined,env:{LOCALAPPDATA:machineHome,TELEGRAM_BOT_TOKEN:TOKEN,NODE_TEST_CONTEXT:'child-v8'}});
    assert.equal(real.skipped,'test context','a spec never reaches the real Bot API');
    assert.equal((await notifyAsk(ask,deps(machineHome,{fetchImpl:bot.fetchImpl,env:{LOCALAPPDATA:machineHome,TELEGRAM_BOT_TOKEN:TOKEN,STARCI_CONNECTORS_OFF:'1'}}))).skipped,'STARCI_CONNECTORS_OFF');
    const failing=fakeBot({status:401,json:{ok:false,description:`Unauthorized for bot${TOKEN}`}});
    const failed=await notifyAsk(ask,deps(machineHome,{fetchImpl:failing.fetchImpl,warn}));
    assert.equal(failed.ok,false);assert.equal(failing.calls.length,1,'a 401 is not retried');
    assert.ok(!JSON.stringify(failed).includes(TOKEN)&&!warned.join('\n').includes(TOKEN),'the token is scrubbed from the failure');
    const thrown=await notifyAsk(ask,deps(machineHome,{warn,fetchImpl:async()=>{throw Error('network down');}}));
    assert.equal(thrown.ok,false);
    const unreadable=await notifyAsk({...ask,ledgerFile:path.join(machineHome,'missing.sqlite')},deps(machineHome,{fetchImpl:bot.fetchImpl,warn}));
    assert.equal(unreadable.ok,false);
    ledger.appendEvent({workflowId:'wf-a',entityType:'report',entityId:'ctx_a',kind:'ask-answered',payload:{dispatchId:'ctx_a'}});
    assert.equal((await notifyAsk(ask,deps(path.join(machineHome,'fresh'),{fetchImpl:bot.fetchImpl}))).skipped,'already answered');
  });
});

test('Bot API calls retry 429 and 5xx politely, fail fast on 4xx, and scrub the token from errors',async()=>{
  const waits=[];const sleepImpl=async ms=>{waits.push(ms);};
  const limited=fakeBot({sequence:[{status:429,json:{ok:false,description:'Too Many Requests: retry after 3',parameters:{retry_after:3}}},{status:200,json:{ok:true,result:{message_id:7}}}]});
  const ok=await sendMessage({token:TOKEN,chatId:'1',text:'hi',apiBase:'http://bot.invalid',fetchImpl:limited.fetchImpl,sleepImpl});
  assert.deepEqual([ok.ok,ok.messageId,waits[0]],[true,7,3000]);
  const flaky=fakeBot({sequence:[{status:502,json:null},{status:503,json:null},{status:200,json:{ok:true,result:{message_id:8}}}]});
  assert.equal((await sendMessage({token:TOKEN,chatId:'1',text:'hi',apiBase:'http://bot.invalid',fetchImpl:flaky.fetchImpl,sleepImpl})).ok,true);
  assert.equal(flaky.calls.length,3);
  const thrown=await sendMessage({token:TOKEN,chatId:'1',text:'hi',apiBase:'http://bot.invalid',attempts:2,sleepImpl,fetchImpl:async url=>{throw Object.assign(Error('fetch failed'),{cause:Error(`connect ECONNREFUSED ${url}`)});}});
  assert.equal(thrown.ok,false);assert.ok(!thrown.error.includes(TOKEN),thrown.error);
  assert.equal(redact(`x ${TOKEN} y bot987654:ABCDEFGHIJKLMNOPQRSTUVWXYZ z`,TOKEN),'x *** y bot*** z');
});

test('discover-chat lists chat ids, types and names only',async()=>{
  const bot=fakeBot({sequence:[{status:200,json:{ok:true,result:[
    {update_id:1,message:{message_id:1,text:'/start secret words',chat:{id:5550001,type:'private',first_name:'Thầy',last_name:'Ci',username:'owner'}}},
    {update_id:2,message:{message_id:2,text:'again',chat:{id:5550001,type:'private',first_name:'Thầy'}}},
    {update_id:3,my_chat_member:{chat:{id:-1009,type:'supergroup',title:'StarCi owners'}}},
  ]}}]});
  const r=await discoverChats({token:TOKEN,apiBase:'http://bot.invalid',fetchImpl:bot.fetchImpl});
  assert.deepEqual(r,{ok:true,chats:[{id:5550001,type:'private',name:'Thầy Ci',username:'owner'},{id:-1009,type:'supergroup',name:'StarCi owners',username:null}]});
  assert.ok(!JSON.stringify(r).includes('secret words'),'message text is never printed');
  assert.equal(bot.calls[0].method,'getUpdates');
});

test('the one send point is serve-ask binding; the supervisor and the kernel api carry no Telegram call',()=>{
  const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
  assert.match(read('scripts/kernel/serve-ask.mjs'),/if \(!readonly\) notifyAsk\(\{ ledgerFile: file, workflowId: args\.workflow, dispatchId: report\.dispatch_id \}\)/);
  for(const p of ['scripts/supervisor/poll.mjs','scripts/kernel/watchdog.mjs'])
    assert.doesNotMatch(read(p),/connectors\/telegram|api\.telegram\.org/,`${p} must not notify`);
  // retire-ask edits the owner's existing message; the kernel api never sends a new one.
  assert.doesNotMatch(read('scripts/kernel/api.mjs'),/notifyAsk|sendMessage|api\.telegram\.org/,'the kernel api never sends');
  assert.match(read('scripts/kernel/api.mjs'),/import \{ markAskClosed \} from '\.\.\/connectors\/telegram\.mjs'/);
});

// The owner asked that an answered question stop looking open in Telegram:
// the sent message is edited in place, the question kept and the link gone.
test('an answered or retired ask edits its Telegram message and drops the link',async t=>{
  await withLedger(t,async({ledger,ledgerFile,machineHome})=>{
    seedServing(ledger,{workflowId:'wf-close',dispatchId:'ctx_close',url:`http://127.0.0.1:6975/${NONCE}`,question:{text:'Cổng thanh toán nào?',options:['VNPay','MoMo']}});
    const bot=fakeBot();
    await notifyAsk({ledgerFile,workflowId:'wf-close',dispatchId:'ctx_close'},deps(machineHome,{fetchImpl:bot.fetchImpl}));
    const closed=await markAskClosed({ledgerFile,workflowId:'wf-close',dispatchId:'ctx_close',reason:'answered',by:'owner'},deps(machineHome,{fetchImpl:bot.fetchImpl}));
    assert.deepEqual([closed.ok,closed.edited,closed.reason],[true,101,'answered'],'the message the ask was sent as (fakeBot ids start at 101)');
    const edit=bot.calls.at(-1);
    assert.match(edit.url,/editMessageText$/);
    assert.equal(edit.body.message_id,101);
    assert.match(edit.body.text,/^\[StarCi\] Đã trả lời \(lúc .*owner\)/);
    assert.match(edit.body.text,/Cổng thanh toán nào\?/);
    assert.ok(!edit.body.text.includes('/a-'),'the answered message carries no link');
    const again=await markAskClosed({ledgerFile,workflowId:'wf-close',dispatchId:'ctx_close',reason:'retired'},deps(machineHome,{fetchImpl:bot.fetchImpl}));
    assert.equal(again.skipped,'already answered','a closed message is edited once');
    const never=await markAskClosed({ledgerFile,workflowId:'wf-close',dispatchId:'ctx_never'},deps(machineHome,{fetchImpl:bot.fetchImpl}));
    assert.equal(never.skipped,'no message sent for this ask');
  });
});
