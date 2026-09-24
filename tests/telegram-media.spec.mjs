import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withLedger,seedWorkflow} from './_ledger-fixture.mjs';
import {parseYaml} from '../engine/yaml.mjs';
import {sendSettleMedia,queueSettleMedia,collectDrawings,mediaKindOf,mediaSentFile,fitCaption} from '../scripts/connectors/telegram-media.mjs';

// scripts/connectors/telegram-media.mjs sends the owner the drawings of a settled interface.draw and
// the videos of a settled UAT op over Telegram. Every spec runs on a fake Bot API: no network.

const EXAMPLE=parseYaml(fs.readFileSync(new URL('../config.example.yaml',import.meta.url),'utf8'));
const TOKEN='123456789:AAFakeTokenForSpecsOnly_abcdefghijklmnop';
const configWith=(telegram)=>({...structuredClone(EXAMPLE),language:'vi',connectors:{secretsFile:null,telegram}});
const ON=configWith({enabled:true,chatId:'4242'});
const OFF=configWith({enabled:false});

/** A fake Bot API: records every call (multipart fields as values, JSON bodies parsed); `fail(method,n)` scripts errors. */
const fakeBot=({fail=null}={})=>{
  const calls=[];
  const fetchImpl=async(url,init)=>{
    const method=url.split('/').pop();
    const body=init.body instanceof FormData?Object.fromEntries([...new Set(init.body.keys())].map(k=>[k,init.body.get(k)])):JSON.parse(init.body);
    calls.push({url,method,body});
    const failure=fail?.(method,calls.length);
    if(failure)return {ok:false,status:failure.status,json:async()=>({ok:false,description:failure.description??'Bad Request'})};
    return {ok:true,status:200,json:async()=>({ok:true,result:{message_id:calls.length}})};
  };
  return {calls,fetchImpl,of:m=>calls.filter(c=>c.method===m)};
};
const deps=(machineHome,extra={})=>({config:ON,env:{LOCALAPPDATA:machineHome,TELEGRAM_BOT_TOKEN:TOKEN},apiBase:'http://bot.invalid',sleepImpl:async()=>{},warn:()=>{},...extra});

const put=(root,rel,content='x')=>{const file=path.join(root,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content);return file;};
const sized=(root,rel,bytes)=>{const file=put(root,rel,'');fs.truncateSync(file,bytes);return file;};
const seedReport=(ledger,{workflowId='wf-shop-x1',title='shop-checkout',dispatchId,op,attempt=1,summary,files})=>{
  if(!ledger.db.prepare('SELECT 1 FROM workflows WHERE workflow_id=?').get(workflowId))seedWorkflow(ledger,{id:workflowId,state:{phase:'running',job:title}});
  ledger.db.prepare('INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,created_at) VALUES(?,?,?,?,?,?,?,?)')
    .run(workflowId,dispatchId,op,attempt,1,'done',JSON.stringify({schema:'starci/op-report@1',outcome:'done',summary,files}),Date.now());
};

const UI='.starciwork/features/shop/ui/cart';
const seedDraw=(repoRoot)=>{
  put(repoRoot,`${UI}/index.yaml`,[
    'schema: work/ui-screen@1','id: ui.shop.cart','title: Cart','ui:','  surfaces:','    - {name: Cart}','    - {name: Checkout}',
    '  states:','    - {name: cart-ready}','    - {name: cart-empty}','    - {name: checkout-failed}',
    '  coverage:','    responsiveBands: [mobile-375, desktop-1440]','    themes: [light, dark]',''].join('\n'));
  put(repoRoot,`${UI}/assets/cart-desktop.png`,'desktop-bytes');
  put(repoRoot,`${UI}/assets/cart-desktop.source.png`,'edit-source-bytes');
  put(repoRoot,`${UI}/assets/cart-mobile-dark.png`,'mobile-bytes');
  // draws[].image resolves against the draws file first, then the ui record.
  put(repoRoot,`${UI}/evidence/r1/draws.yaml`,[
    'schema: starci/ui-draws@1','draws:',
    '  - {id: cart-desktop, screen: cart, state: cart-ready, viewport: desktop-1440, theme: light, image: ../../assets/cart-desktop.png}',
    '  - {id: cart-mobile, screen: cart, state: cart-empty, viewport: mobile-375, theme: dark, image: assets/cart-mobile-dark.png}',''].join('\n'));
  return [`${UI}/index.yaml`,`${UI}/assets/cart-desktop.png`,`${UI}/assets/cart-desktop.source.png`,`${UI}/assets/cart-mobile-dark.png`,`${UI}/evidence/r1/draws.yaml`];
};
const DRAW={workflowId:'wf-shop-x1',jobId:'job-draw-1',attempt:1,op:'interface.draw',verdict:'pass',dispatchId:'ctx_draw'};

const FLOW='.starciwork/features/shop/uat/checkout';
const seedUat=(repoRoot,{video=true}={})=>{
  put(repoRoot,`${FLOW}/index.yaml`,[
    'schema: work/uat-flow@1','id: uat.shop.checkout','title: Buy one item','evidence: runs/run-1','steps:',
    '  - Open the shop and add one item to the cart.','  - Pay with the test card.','  - See the order confirmation.',''].join('\n'));
  if(video)put(repoRoot,`${FLOW}/runs/run-1/videos/checkout.webm`,'webm-bytes');
  put(repoRoot,`${FLOW}/runs/run-1/screens/01-cart.png`,'png-1');
  put(repoRoot,`${FLOW}/runs/run-1/screens/02-paid.png`,'png-2');
  put(repoRoot,`${FLOW}/runs/run-1/manifest.yaml`,'schema: starci/uat-run-manifest@1\n');
  return [`${FLOW}/index.yaml`];
};
const UAT={workflowId:'wf-shop-x1',jobId:'job-uat-1',attempt:1,op:'uat.verify',verdict:'fail',dispatchId:'ctx_uat'};

test('media kinds: draw and asset ops send drawings, UAT and e2e ops send videos, nothing else sends',()=>{
  assert.deepEqual(['interface.draw','interface.asset','uat.verify','uat.assisted.prepare','uat.assisted.verify','e2e.verify','backend.implement',null].map(mediaKindOf),
    ['draw','draw','uat','uat','uat','uat',null,null]);
  assert.equal(fitCaption(['head'],['a'.repeat(50),'b'.repeat(50)],['tail'],70),`head\n${'a'.repeat(50)}\ntail`,'body lines drop from the end; head and tail stay');
});

test('a settled interface.draw sends its drawings as one album with a Vietnamese caption',async t=>{
  await withLedger(t,async({ledger,ledgerFile,repoRoot,machineHome})=>{
    const files=seedDraw(repoRoot);
    seedReport(ledger,{dispatchId:'ctx_draw',op:'interface.draw',summary:'Đã vẽ 2 hướng giao diện giỏ hàng.',files});
    const bot=fakeBot();
    const r=await sendSettleMedia({ledgerFile,repo:repoRoot,...DRAW},deps(machineHome,{fetchImpl:bot.fetchImpl}));
    assert.deepEqual([r.ok,r.kind,r.sent,r.failed],[true,'draw',1,0]);
    assert.equal(bot.calls.length,1);
    const [call]=bot.calls;
    assert.equal(call.url,`http://bot.invalid/bot${TOKEN}/sendMediaGroup`);
    assert.equal(call.body.chat_id,'4242');
    const media=JSON.parse(call.body.media);
    assert.deepEqual(media.map(m=>[m.type,m.media]),[['photo','attach://f0'],['photo','attach://f1']]);
    assert.deepEqual([call.body.f0.name,call.body.f1.name],['cart-desktop.png','cart-mobile-dark.png'],'the drawn directions, never the .source working copy');
    assert.equal(await call.body.f0.text(),'desktop-bytes');
    assert.equal(call.body.f0.type,'image/png');
    const caption=media[0].caption;
    assert.equal(media[1].caption,undefined,'one caption for the album');
    assert.match(caption,/^🎨 \[StarCi\] shop-checkout đã vẽ xong giao diện shop\/cart\n/);
    assert.match(caption,/Màn hình: 2 \(Cart, Checkout\)/);
    assert.match(caption,/Biến thể: desktop, mobile · sáng, tối/);
    assert.match(caption,/Trạng thái: 3/);
    assert.match(caption,/Tóm tắt: Đã vẽ 2 hướng giao diện giỏ hàng\./);
    assert.match(caption,/1\. cart · cart-ready · desktop · sáng\n2\. cart · cart-empty · mobile · tối/);
    assert.match(caption,/Thầy xem kỹ khi bàn giao \(handover\), hoặc góp ý bất cứ lúc nào\.$/);
    assert.ok(caption.length<=1024);
    const state=fs.readFileSync(mediaSentFile({LOCALAPPDATA:machineHome}),'utf8');
    assert.ok(!state.includes(TOKEN)&&!JSON.stringify(r).includes(TOKEN),'the token never reaches the state or the result');
  });
});

test('without a draws.yaml the drawings are the images the report names, minus working and evidence copies',t=>{
  withLedger(t,({repoRoot})=>{
    const files=[`${UI}/index.yaml`,`${UI}/assets/a.png`,`${UI}/assets/a.pre-final.png`,`${UI}/assets/b.initial.png`,`${UI}/assets/b-mobile.webp`,`${UI}/evidence/r2/direction.png`,`${UI}/assets/a.prompt.txt`]
      .map(rel=>put(repoRoot,rel,rel.endsWith('index.yaml')?'schema: work/ui-screen@1\nid: ui.shop.cart\n':'x'));
    const {picks,nodes}=collectDrawings({files,repo:repoRoot});
    assert.deepEqual(picks.map(p=>path.basename(p.file)),['a.png','b-mobile.webp']);
    assert.equal(picks[1].viewport,'mobile','a band read off the file name');
    assert.deepEqual(nodes.map(n=>n.label),['shop/cart']);
  });
});

test('a settled UAT op sends each video with the verdict and the flow steps, whatever the verdict',async t=>{
  await withLedger(t,async({ledger,ledgerFile,repoRoot,machineHome})=>{
    const files=seedUat(repoRoot);
    seedReport(ledger,{dispatchId:'ctx_uat',op:'uat.verify',summary:'Thanh toán thẻ test bị từ chối ở bước 2.',files});
    const bot=fakeBot();
    const r=await sendSettleMedia({ledgerFile,repo:repoRoot,...UAT},deps(machineHome,{fetchImpl:bot.fetchImpl}));
    assert.deepEqual([r.ok,r.kind,r.sent],[true,'uat',1]);
    assert.deepEqual(bot.calls.map(c=>c.method),['sendVideo'],'videos only: the screenshots stay on the machine when a video exists');
    const {body}=bot.calls[0];
    assert.equal(body.video.name,'checkout.webm');
    assert.equal(body.video.type,'video/webm');
    assert.equal(body.supports_streaming,'true');
    assert.equal(body.caption,[
      '🎬 [StarCi] UAT Buy one item: KHÔNG ĐẠT','Workflow: shop-checkout','Tóm tắt: Thanh toán thẻ test bị từ chối ở bước 2.','Các bước:',
      '1. Open the shop and add one item to the cart.','2. Pay with the test card.','3. See the order confirmation.'].join('\n'));
  });
});

test('a passing UAT without a video sends its screenshots as an album; a failing one sends nothing',async t=>{
  await withLedger(t,async({ledger,ledgerFile,repoRoot,machineHome})=>{
    const files=seedUat(repoRoot,{video:false});
    seedReport(ledger,{dispatchId:'ctx_uat',op:'uat.verify',summary:'Mua hàng thành công.',files});
    const failing=fakeBot();
    const none=await sendSettleMedia({ledgerFile,repo:repoRoot,...UAT},deps(machineHome,{fetchImpl:failing.fetchImpl}));
    assert.match(none.skipped,/no UAT video/);assert.equal(failing.calls.length,0);
    const bot=fakeBot();
    const r=await sendSettleMedia({ledgerFile,repo:repoRoot,...UAT,verdict:'pass'},deps(machineHome,{fetchImpl:bot.fetchImpl}));
    assert.equal(r.sent,1);
    const [call]=bot.calls;
    assert.equal(call.method,'sendMediaGroup');
    const media=JSON.parse(call.body.media);
    assert.equal(media.length,2);
    assert.match(media[0].caption,/^🎬 \[StarCi\] UAT Buy one item: ĐẠT\nWorkflow: shop-checkout\n2 ảnh chụp màn hình \(không có video\)/);
    assert.match(media[0].caption,/1\. Open the shop/);
  });
});

test('one send per job attempt: a repeat is skipped, a new attempt sends, and a send that delivered nothing can retry',async t=>{
  await withLedger(t,async({ledger,ledgerFile,repoRoot,machineHome})=>{
    const files=seedDraw(repoRoot);
    seedReport(ledger,{dispatchId:'ctx_draw',op:'interface.draw',summary:'s',files});
    seedReport(ledger,{dispatchId:'ctx_draw2',op:'interface.draw',attempt:2,summary:'s2',files});
    const bot=fakeBot();
    const first=await sendSettleMedia({ledgerFile,repo:repoRoot,...DRAW},deps(machineHome,{fetchImpl:bot.fetchImpl}));
    const again=await sendSettleMedia({ledgerFile,repo:repoRoot,...DRAW},deps(machineHome,{fetchImpl:bot.fetchImpl}));
    assert.equal(first.sent,1);assert.equal(again.skipped,'already sent');assert.equal(bot.calls.length,1);
    const next=await sendSettleMedia({ledgerFile,repo:repoRoot,...DRAW,attempt:2,dispatchId:'ctx_draw2'},deps(machineHome,{fetchImpl:bot.fetchImpl}));
    assert.equal(next.sent,1,'attempt 2 is its own send');
    const store=JSON.parse(fs.readFileSync(mediaSentFile({LOCALAPPDATA:machineHome}),'utf8'));
    assert.deepEqual(Object.keys(store.jobs).sort(),['wf-shop-x1|job-draw-1|1','wf-shop-x1|job-draw-1|2']);
    const home=path.join(machineHome,'retry');
    const down=fakeBot({fail:()=>({status:500,description:'Internal'})});
    const lost=await sendSettleMedia({ledgerFile,repo:repoRoot,...DRAW},deps(home,{fetchImpl:down.fetchImpl}));
    assert.deepEqual([lost.ok,lost.sent],[false,0]);
    const retried=await sendSettleMedia({ledgerFile,repo:repoRoot,...DRAW},deps(home,{fetchImpl:bot.fetchImpl}));
    assert.equal(retried.sent,1,'nothing was delivered, so the claim was released');
  });
});

test('oversize media: images over 10 MB are listed not sent, albums split at 10, videos over 50 MB become a note',async t=>{
  await withLedger(t,async({ledger,ledgerFile,repoRoot,machineHome})=>{
    const files=[put(repoRoot,`${UI}/index.yaml`,'schema: work/ui-screen@1\nid: ui.shop.cart\n')];
    for(let i=1;i<=12;i++)files.push(put(repoRoot,`${UI}/assets/screen-${String(i).padStart(2,'0')}.png`,`img-${i}`));
    const huge=sized(repoRoot,`${UI}/assets/screen-huge.png`,10*1024*1024+1);
    files.push(huge);
    seedReport(ledger,{dispatchId:'ctx_draw',op:'interface.draw',summary:'Nhiều màn hình.',files});
    const bot=fakeBot();
    const r=await sendSettleMedia({ledgerFile,repo:repoRoot,...DRAW},deps(machineHome,{fetchImpl:bot.fetchImpl}));
    assert.deepEqual([r.sent,r.failed],[2,0]);
    const albums=bot.of('sendMediaGroup').map(c=>JSON.parse(c.body.media));
    assert.deepEqual(albums.map(a=>a.length),[10,2]);
    assert.ok(!bot.calls.some(c=>Object.values(c.body).some(v=>v?.name==='screen-huge.png')),'the 10 MB+ image is never uploaded');
    assert.ok(albums[0][0].caption.includes(`1 ảnh lớn hơn 10 MB không gửi qua Telegram, xem trên máy: ${huge}`));
    assert.match(albums[1][0].caption,/^🎨 \[StarCi\] shop-checkout đã vẽ xong giao diện shop\/cart \(tiếp 2\/2\)$/);

    const uatFiles=seedUat(repoRoot,{video:false});
    const big=sized(repoRoot,`${FLOW}/runs/run-1/videos/checkout.webm`,50*1024*1024+1);
    seedReport(ledger,{dispatchId:'ctx_uat',op:'uat.verify',summary:'Video dài.',files:uatFiles});
    const vbot=fakeBot();
    const v=await sendSettleMedia({ledgerFile,repo:repoRoot,...UAT,verdict:'pass'},deps(machineHome,{fetchImpl:vbot.fetchImpl}));
    assert.equal(v.sent,1);
    assert.deepEqual(vbot.calls.map(c=>c.method),['sendMessage']);
    const text=vbot.calls[0].body.text;
    assert.match(text,/^🎬 \[StarCi\] UAT Buy one item: ĐẠT\n/);
    assert.ok(text.includes(`Video lớn hơn 50 MB nên không gửi qua Telegram; xem trên máy: ${big}`));
    assert.match(text,/Các bước:\n1\. Open the shop/);
  });
});

test('Telegram refusing a photo album or a webm video retries the same files as documents',async t=>{
  await withLedger(t,async({ledger,ledgerFile,repoRoot,machineHome})=>{
    const files=seedDraw(repoRoot);
    seedReport(ledger,{dispatchId:'ctx_draw',op:'interface.draw',summary:'s',files});
    const bot=fakeBot({fail:(method,n)=>(n===1?{status:400,description:'Bad Request: PHOTO_INVALID_DIMENSIONS'}:null)});
    const r=await sendSettleMedia({ledgerFile,repo:repoRoot,...DRAW},deps(machineHome,{fetchImpl:bot.fetchImpl}));
    assert.equal(r.sent,1);
    assert.deepEqual(bot.calls.map(c=>[c.method,JSON.parse(c.body.media)[0].type]),[['sendMediaGroup','photo'],['sendMediaGroup','document']]);
    const uatFiles=seedUat(repoRoot);
    seedReport(ledger,{dispatchId:'ctx_uat',op:'uat.verify',summary:'s',files:uatFiles});
    const vbot=fakeBot({fail:(method)=>(method==='sendVideo'?{status:400,description:'Bad Request: wrong file type'}:null)});
    const v=await sendSettleMedia({ledgerFile,repo:repoRoot,...UAT},deps(machineHome,{fetchImpl:vbot.fetchImpl}));
    assert.equal(v.sent,1);
    assert.deepEqual(vbot.calls.map(c=>c.method),['sendVideo','sendDocument']);
    assert.equal(vbot.calls[1].body.document.name,'checkout.webm');
  });
});

test('off: Telegram disabled, connectors off, a spec run, a non-media op or a draw that did not pass send nothing and launch nothing',async t=>{
  await withLedger(t,async({ledger,ledgerFile,repoRoot,machineHome})=>{
    const files=seedDraw(repoRoot);
    seedReport(ledger,{dispatchId:'ctx_draw',op:'interface.draw',summary:'s',files});
    const bot=fakeBot(),warned=[];
    const off=await sendSettleMedia({ledgerFile,repo:repoRoot,...DRAW},deps(machineHome,{fetchImpl:bot.fetchImpl,config:OFF,env:{LOCALAPPDATA:machineHome},warn:w=>warned.push(w)}));
    assert.equal(off.skipped,'telegram off');assert.deepEqual(warned,[]);
    assert.equal((await sendSettleMedia({ledgerFile,repo:repoRoot,...DRAW},deps(machineHome,{fetchImpl:bot.fetchImpl,env:{LOCALAPPDATA:machineHome,TELEGRAM_BOT_TOKEN:TOKEN,STARCI_CONNECTORS_OFF:'1'}}))).skipped,'STARCI_CONNECTORS_OFF');
    assert.equal((await sendSettleMedia({ledgerFile,repo:repoRoot,...DRAW},{...deps(machineHome),apiBase:undefined,env:{LOCALAPPDATA:machineHome,TELEGRAM_BOT_TOKEN:TOKEN,NODE_TEST_CONTEXT:'child-v8'}})).skipped,'test context','a spec never reaches the real Bot API');
    assert.equal((await sendSettleMedia({ledgerFile,repo:repoRoot,...DRAW,verdict:'fail'},deps(machineHome,{fetchImpl:bot.fetchImpl}))).skipped,'a draw is sent when it settles pass');
    assert.equal((await sendSettleMedia({ledgerFile,repo:repoRoot,...DRAW,op:'backend.implement'},deps(machineHome,{fetchImpl:bot.fetchImpl}))).skipped,'not a media op');
    assert.equal(bot.calls.length,0);

    const spawned=[];const spawnImpl=(...a)=>{spawned.push(a);return {pid:4242,on(){},unref(){}};};
    const job={ledgerFile,repo:repoRoot,...DRAW};
    const env={LOCALAPPDATA:machineHome,TELEGRAM_BOT_TOKEN:TOKEN,STARCI_TELEGRAM_API_BASE:'http://bot.invalid'};
    assert.equal(queueSettleMedia(job,{env,config:OFF,spawnImpl}).skipped,'telegram off');
    assert.equal(queueSettleMedia({...job,verdict:'fail'},{env,config:ON,spawnImpl}).skipped,'a draw is sent when it settles pass');
    assert.equal(queueSettleMedia({...job,op:'scope.define'},{env,config:ON,spawnImpl}).skipped,'not a media op');
    assert.equal(queueSettleMedia(job,{env:{...env,STARCI_TELEGRAM_API_BASE:undefined,NODE_TEST_CONTEXT:'child-v8'},config:ON,spawnImpl}).skipped,'test context');
    assert.equal(queueSettleMedia(job,{env:{...env,STARCI_CONNECTORS_OFF:'1'},config:ON,spawnImpl}).skipped,'STARCI_CONNECTORS_OFF');
    assert.equal(spawned.length,0);
    const queued=queueSettleMedia({...UAT,ledgerFile,repo:repoRoot},{env,config:ON,spawnImpl});
    assert.deepEqual([queued.queued,queued.pid],[true,4242],'a UAT settle queues whatever the verdict');
    const [exe,args,options]=spawned[0];
    assert.equal(exe,process.execPath);
    assert.match(args[0],/telegram-media\.mjs$/);
    assert.deepEqual(args.slice(1),['settle','--ledger',ledgerFile,'--repo',repoRoot,'--workflow','wf-shop-x1','--job','job-uat-1','--attempt','1','--op','uat.verify','--verdict','fail','--dispatch','ctx_uat']);
    assert.equal(options.detached,true,'the sender outlives the settle process');
    assert.ok(!args.join(' ').includes(TOKEN),'the token is never on a command line');
  });
});

test('settle never fails because Telegram failed: the hook is synchronous, never throws, and the sender never rejects',async t=>{
  await withLedger(t,async({ledger,ledgerFile,repoRoot,machineHome})=>{
    const files=seedDraw(repoRoot);
    seedReport(ledger,{dispatchId:'ctx_draw',op:'interface.draw',summary:'s',files});
    const env={LOCALAPPDATA:machineHome,TELEGRAM_BOT_TOKEN:TOKEN,STARCI_TELEGRAM_API_BASE:'http://bot.invalid'};
    const saved=process.stderr.write;const errs=[];process.stderr.write=(s)=>{errs.push(String(s));return true;};
    let thrown,broken;
    try{
      thrown=queueSettleMedia({ledgerFile,repo:repoRoot,...DRAW},{env,config:ON,spawnImpl:()=>{throw Error(`spawn EPERM bot${TOKEN}`);}});
      broken=queueSettleMedia(null,{env,config:ON});
    }finally{process.stderr.write=saved;}
    assert.equal(thrown instanceof Promise,false,'the settle never waits on Telegram');
    assert.deepEqual([thrown.queued,broken.queued],[false,false]);
    assert.equal(errs.length,1);assert.match(errs[0],/^telegram-media: not queued:/);
    assert.ok(!errs[0].includes(TOKEN),'the token is scrubbed from the stderr line');
    const warned=[];
    const netDown=await sendSettleMedia({ledgerFile,repo:repoRoot,...DRAW},deps(machineHome,{warn:w=>warned.push(w),fetchImpl:async()=>{throw Error('network down');}}));
    assert.equal(netDown.ok,false);
    assert.match(warned.join('\n'),/album not sent: network down/);
    const unauthorized=await sendSettleMedia({ledgerFile,repo:repoRoot,...DRAW},deps(path.join(machineHome,'b'),{warn:w=>warned.push(w),fetchImpl:fakeBot({fail:()=>({status:401,description:`Unauthorized bot${TOKEN}`})}).fetchImpl}));
    assert.equal(unauthorized.ok,false);
    assert.ok(!warned.join('\n').includes(TOKEN));
    const noLedger=await sendSettleMedia({ledgerFile:path.join(machineHome,'missing.sqlite'),repo:repoRoot,...DRAW},deps(machineHome,{warn:w=>warned.push(w)}));
    assert.deepEqual([noLedger.ok,noLedger.error],[false,'ledger unreadable']);
    // The kernel's settle queues the send after the settled state is written, inside its own try.
    const api=fs.readFileSync(new URL('../scripts/kernel/api.mjs',import.meta.url),'utf8');
    const hook=api.indexOf('try { queueSettleMedia(');
    assert.ok(hook>api.indexOf('function cmdSettle(')&&hook>api.indexOf('const taskClosed = closeOperationTask(db, job, settledPayload);'),'cmdSettle queues media after the settle');
    assert.ok(hook<api.indexOf("emit(out, `settled ${jobId}",api.indexOf('function cmdSettle(')),'before the settle reports');
  });
});

// Owner ruling 2026-09-24: a drawing notice shows the drawn PART (page content, overlay panel, layout
// drawing), never the composite placed into the layout capture.
test('a drawing notice sends each draw\'s part, never its composite; desktop and mobile both go',t=>{
  withLedger(t,({repoRoot})=>{
    const P=`${UI}/assets/directions`;
    const files=[
      put(repoRoot,`${UI}/index.yaml`,[
        'schema: work/ui-screen@1','id: ui.shop.cart','assets:',
        `  - {path: assets/directions/cart--page--desktop--light.content.png, role: direction-content, sha256: '${'a'.repeat(64)}'}`,
        `  - path: assets/directions/cart--page--desktop--light.png`,'    role: direction',`    sha256: '${'b'.repeat(64)}'`,
        '    composite: {presentation: page, breakpoint: desktop, theme: light, content: {path: assets/directions/cart--page--desktop--light.content.png}}',''].join('\n')),
      put(repoRoot,`${P}/cart--page--desktop--light.png`,'composite-desktop'),
      put(repoRoot,`${P}/cart--page--desktop--light.content.png`,'part-desktop'),
      put(repoRoot,`${P}/cart--page--mobile--light.png`,'composite-mobile'),
      put(repoRoot,`${P}/cart--page--mobile--light.content.png`,'part-mobile'),
      put(repoRoot,`${UI}/evidence/r7/draws.yaml`,[
        'schema: starci/ui-draws@1','draws:',
        '  - id: cart-desktop','    screen: cart','    state: cart-ready','    breakpoint: desktop','    theme: light',
        '    image: {path: assets/directions/cart--page--desktop--light.png}','    content: {path: assets/directions/cart--page--desktop--light.content.png}',
        '  - id: cart-mobile','    screen: cart','    state: cart-ready','    breakpoint: mobile','    theme: light',
        '    image: assets/directions/cart--page--mobile--light.png',''].join('\n')),
    ];
    const {picks}=collectDrawings({files,repo:repoRoot});
    assert.deepEqual(picks.map(p=>path.basename(p.file)),['cart--page--desktop--light.content.png','cart--page--mobile--light.content.png'],'a legacy image: composite still finds its .content part');
    assert.deepEqual(picks.map(p=>p.viewport),['desktop','mobile'],'the draw breakpoint names the band');
    const noDraws=collectDrawings({files:files.filter(f=>!f.endsWith('draws.yaml')),repo:repoRoot});
    assert.deepEqual(noDraws.picks.map(p=>path.basename(p.file)),['cart--page--desktop--light.content.png','cart--page--mobile--light.content.png'],'named composites collapse into their parts');
  });
});
