import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {withLedger,seedWorkflow,awaitExit} from './_ledger-fixture.mjs';
import {validateOpReport} from '../scripts/kernel/report-envelope.mjs';
import {recommendationOf,textRecommendation,askExclusionOf,autoAcceptDecision,AUTO_ACCEPTED_BY} from '../scripts/kernel/ask-recommendation.mjs';
import {validateConfig,askAutoAcceptPolicy,ASKS_DEFAULTS} from '../engine/config.mjs';
import {parseYaml} from '../engine/yaml.mjs';
import {autoAcceptAsk,wakeAskAnswered} from '../scripts/kernel/serve-ask.mjs';
import {autoAcceptedMessage,notifyAutoAccepted} from '../scripts/connectors/telegram.mjs';
import {openAsks} from '../scripts/supervisor/poll.mjs';

// config.yaml asks.autoAcceptRecommended: an owner ask that carries a recommended
// option is answered with it instead of being served, so the workflow keeps moving
// while the owner sleeps. Credential, excluded-kind and handover asks always reach
// the owner; the flag off changes nothing.

const ROOT=path.resolve(import.meta.dirname,'..');
const SERVE_ASK=path.join(ROOT,'scripts','kernel','serve-ask.mjs');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const EXAMPLE=parseYaml(fs.readFileSync(new URL('../config.example.yaml',import.meta.url),'utf8'));
const WORKFLOW='wf-auto-accept';
const ON={autoAcceptRecommended:true,excludes:['credential','irreversible-confirmation','handover'],source:'asks'};
const TOKEN='123456789:AAFakeTokenForSpecsOnly_abcdefghijklmnop';

const RECOMMENDED={text:'Mời thành viên bằng cách nào?',options:['Mời bằng email','Mời bằng link'],recommended:0,recommendedReason:'email đã có sẵn luồng xác thực'};
const TEXT_MARKED={text:'Hoàn tiền khi huỷ gói?',options:['Tự động hoàn tiền đầy đủ (khuyến nghị): khách không phải chờ','Hoàn tiền thủ công']};

const seedAsk=(ledger,{dispatchId,question,opId='provision.ask',workflowId=WORKFLOW})=>{
  ledger.transaction(db=>{
    db.prepare(`INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,created_at)
      VALUES(?,?,?,?,?,?,?,?)`).run(workflowId,dispatchId,opId,1,1,'ask',
      JSON.stringify({schema:'starci/op-report@1',outcome:'ask',summary:`ask ${dispatchId}`,question}),Date.now());
  });
  return ledger.db.prepare('SELECT * FROM reports WHERE workflow_id=? AND dispatch_id=?').get(workflowId,dispatchId);
};
const events=(ledger,kind)=>ledger.db.prepare('SELECT payload_json FROM events WHERE workflow_id=? AND kind=? ORDER BY seq').all(WORKFLOW,kind).map(r=>JSON.parse(r.payload_json));
const spies=()=>{
  const woken=[],notified=[];
  return {woken,notified,wake:(ledger,args)=>{woken.push(args);return {action:'kernel-woken'};},notify:async args=>{notified.push(args);return {ok:true,sent:1};}};
};

/* ------------------------------------------------------------ envelope */

test('the report envelope accepts question.recommended as an option index with its reason and refuses anything else',()=>{
  const ask=question=>validateOpReport({outcome:'ask',summary:'asks',question});
  assert.equal(ask(RECOMMENDED).ok,true);
  assert.equal(ask({...RECOMMENDED,recommendedReason:undefined}).ok,true,'the reason is optional');
  assert.equal(ask({text:'q',options:['a','b']}).ok,true,'a recommendation is optional');
  for(const [question,pattern] of [
    [{...RECOMMENDED,recommended:2},/question\.recommended must be the 0-based index/],
    [{...RECOMMENDED,recommended:-1},/question\.recommended must be the 0-based index/],
    [{...RECOMMENDED,recommended:'0'},/question\.recommended must be the 0-based index/],
    [{...RECOMMENDED,recommended:0.5},/question\.recommended must be the 0-based index/],
    [{text:'q',recommended:0},/question\.recommended must be the 0-based index/],
    [{...RECOMMENDED,recommendedReason:42},/recommendedReason must be a string/],
    [{text:'q',options:['a','b'],recommendedReason:'why'},/recommendedReason needs question\.recommended/],
  ]){
    const r=ask(question);
    assert.equal(r.ok,false,JSON.stringify(question));
    assert.ok(r.reasons.some(reason=>pattern.test(reason)),r.reasons.join('; '));
  }
});

/* ------------------------------------------------------------ recommendation */

test('a recommendation is question.recommended, else exactly one option marked in its text; zero or several mean none',()=>{
  assert.deepEqual(recommendationOf(RECOMMENDED),{index:0,label:'Mời bằng email',reason:'email đã có sẵn luồng xác thực',source:'structured'});
  assert.deepEqual(recommendationOf(TEXT_MARKED),{index:0,label:TEXT_MARKED.options[0],reason:null,source:'text'});
  assert.equal(textRecommendation(['1. (Khuyến nghị) Tạm thời mời bằng email','2. Mời bằng link']),0);
  assert.equal(textRecommendation(['a','b (Recommended)']),1);
  assert.equal(textRecommendation(['a (ĐỀ XUẤT)','b']),0,'case-insensitive, Vietnamese capitals included');
  assert.equal(textRecommendation(['a (khuyến nghị)'.normalize('NFD'),'b']),0,'decomposed text is the same mark');
  assert.equal(textRecommendation([{label:'x (recommended)'},{label:'y'}]),0,'option objects are read by label');
  assert.equal(textRecommendation(['a','b']),null,'none marked');
  assert.equal(textRecommendation(['a (khuyến nghị)','b (đề xuất)']),null,'several marked is no recommendation');
  assert.equal(textRecommendation(['a khuyến nghị','b']),null,'only the parenthesised mark counts');
  assert.equal(recommendationOf({text:'q',options:['a (recommended)','b'],recommended:1}).index,1,'the structured field wins');
  assert.equal(recommendationOf({text:'q'}),null);
});

test('exclusions: secret fields and credential kinds are credential, handover.review is always excluded, kinds match by name',()=>{
  const none={files:[],vars:[]};
  assert.equal(askExclusionOf({question:RECOMMENDED,opId:'provision.ask',secretFields:{files:[],vars:['GITHUB_CLIENT_SECRET']},excludes:['credential']}),'credential');
  for(const kind of ['credential','account','access','consent'])
    assert.equal(askExclusionOf({question:{...RECOMMENDED,kind},opId:'provision.ask',secretFields:none,excludes:['credential']}),'credential',kind);
  assert.equal(askExclusionOf({question:RECOMMENDED,opId:'handover.review',secretFields:none,excludes:[]}),'handover','an empty list still excludes handover');
  assert.equal(askExclusionOf({question:{...RECOMMENDED,kind:'irreversible-confirmation'},opId:'provision.ask',secretFields:none,excludes:['irreversible-confirmation']}),'irreversible-confirmation');
  assert.equal(askExclusionOf({question:{...RECOMMENDED,kind:'decision'},opId:'business.decide',secretFields:none,excludes:['business-decision']}),'business-decision','question.kind decision reads as business-decision');
  assert.equal(askExclusionOf({question:{...RECOMMENDED,kind:'information'},opId:'provision.ask',secretFields:none,excludes:['credential']}),null);
  assert.deepEqual(autoAcceptDecision({question:RECOMMENDED,opId:'provision.ask',secretFields:none,policy:{...ON,autoAcceptRecommended:false}}),{accept:false,why:'flag-off'});
  assert.equal(autoAcceptDecision({question:{text:'q',options:['a','b']},opId:'provision.ask',secretFields:none,policy:ON}).why,'no-recommendation');
  assert.equal(autoAcceptDecision({question:{...RECOMMENDED,picks:[{id:'a',choices:['x','y']},{id:'b',choices:['x','y']}]},opId:'provision.ask',secretFields:none,policy:ON}).why,'several-decisions');
  assert.equal(autoAcceptDecision({question:RECOMMENDED,opId:'provision.ask',secretFields:none,policy:ON}).accept,true);
});

/* ------------------------------------------------------------ config */

test('config.yaml asks validates fail-closed and handover can never be un-excluded',()=>{
  assert.deepEqual(EXAMPLE.asks,{autoAcceptRecommended:false,excludes:['credential','irreversible-confirmation','handover']},'the shipped example is off');
  assert.equal(validateConfig(structuredClone(EXAMPLE)).asks.autoAcceptRecommended,false);
  assert.deepEqual(askAutoAcceptPolicy(EXAMPLE),{autoAcceptRecommended:false,excludes:['credential','irreversible-confirmation','handover'],source:'asks'});
  const withAsks=asks=>({...structuredClone(EXAMPLE),asks});
  const {asks:_,...absent}=structuredClone(EXAMPLE);
  assert.deepEqual(askAutoAcceptPolicy(absent),{autoAcceptRecommended:false,excludes:[...ASKS_DEFAULTS.excludes],source:'default'},'no asks block is the default: off');
  assert.equal(askAutoAcceptPolicy(withAsks(null)).autoAcceptRecommended,false);
  assert.deepEqual(askAutoAcceptPolicy(withAsks({autoAcceptRecommended:true,excludes:[]})).excludes,['handover'],'handover stays excluded when the owner empties the list');
  assert.deepEqual(askAutoAcceptPolicy(withAsks({autoAcceptRecommended:true,excludes:['credential']})).excludes,['credential','handover'],'or drops it from the list');
  assert.deepEqual(askAutoAcceptPolicy(withAsks({autoAcceptRecommended:true})).excludes,['credential','irreversible-confirmation','handover'],'omitted excludes are the defaults');
  assert.doesNotThrow(()=>validateConfig(withAsks({autoAcceptRecommended:true,excludes:['credential','authority','business-decision','information','handover']})));
  for(const [asks,pattern] of [
    [{autoAcceptRecommended:'yes'},/asks\.autoAcceptRecommended must be true or false/],
    [{autoAcceptRecommended:1},/asks\.autoAcceptRecommended must be true or false/],
    [{excludes:'credential'},/asks\.excludes must be a list/],
    [{excludes:['credentials']},/is not an ask class/],
    [{excludes:[42]},/is not an ask class/],
    [{excludes:['credential','credential']},/each class once/],
    [{autoAccept:true},/unknown key autoAccept/],
    [true,/asks must be/],
    [[],/asks must be/],
  ]){
    assert.throws(()=>validateConfig(withAsks(asks)),pattern,JSON.stringify(asks));
    assert.throws(()=>askAutoAcceptPolicy(withAsks(asks)),pattern,'the accessor refuses a malformed block rather than reading it as on');
  }
});

/* ------------------------------------------------------------ auto-accept */

test('an auto-accepted ask writes the serve-ask receipt, ask-answered by auto-recommended and ask-auto-accepted, and wakes the kernel',async t=>{
  await withLedger(t,async({repoRoot,ledger,ledgerFile})=>{
    seedWorkflow(ledger,{id:WORKFLOW,state:{phase:'running'}});
    const report=seedAsk(ledger,{dispatchId:'ctx_invite',question:{...RECOMMENDED,kind:'business-decision'}});
    const spy=spies();
    const r=await autoAcceptAsk({ledger,ledgerFile,repo:repoRoot,workflowId:WORKFLOW,report,policy:ON,wake:spy.wake,notify:spy.notify});
    assert.equal(r.accepted,true);
    assert.equal(r.answeredBy,AUTO_ACCEPTED_BY);
    assert.equal(r.optionIndex,0);

    const [answered]=events(ledger,'ask-answered');
    assert.equal(answered.dispatchId,'ctx_invite');
    assert.equal(answered.answeredBy,'auto-recommended');
    assert.equal(answered.optionIndex,0);
    assert.equal(answered.option,'Mời bằng email');
    assert.match(answered.note,/asks\.autoAcceptRecommended/);
    assert.match(answered.note,/email đã có sẵn luồng xác thực/,'the note cites the recommendedReason');

    const receipt=JSON.parse(fs.readFileSync(answered.receiptPath,'utf8'));
    assert.ok(answered.receiptPath.startsWith(path.join(repoRoot,'.starciwork','kernel-evidence',WORKFLOW,'serve-ask')),'the receipt lives where serve-ask writes it');
    for(const key of ['schema','workflowId','dispatchId','opId','option','optionIndex','picks','answeredBy','custodyWritten','envWritten','pointersWritten','bridge','errors','note','at'])
      assert.ok(Object.hasOwn(receipt,key),`the receipt keeps serve-ask's shape: ${key}`);
    assert.equal(receipt.schema,'starci/ask-answer@1');
    assert.equal(receipt.option,'Mời bằng email');
    assert.equal(receipt.optionIndex,0);
    assert.equal(receipt.answeredBy,'auto-recommended');

    const [audit]=events(ledger,'ask-auto-accepted');
    assert.equal(audit.dispatchId,'ctx_invite');
    assert.equal(audit.rule.key,'asks.autoAcceptRecommended');
    assert.equal(audit.rule.source,'structured');
    assert.deepEqual(audit.config,{autoAcceptRecommended:true,excludes:['credential','irreversible-confirmation','handover'],source:'asks'});

    assert.deepEqual(spy.woken.map(w=>[w.workflowId,w.dispatchId,w.answeredBy,w.receiptPath]),[[WORKFLOW,'ctx_invite','auto-recommended',answered.receiptPath]],'the kernel is woken as a submission wakes it');
    assert.deepEqual(spy.notified.map(n=>[n.dispatchId,n.label]),[['ctx_invite','Mời bằng email']],'one Telegram message');
    assert.deepEqual(await openAsks(ledger.db),[],'the answered ask is no longer open');

    const again=await autoAcceptAsk({ledger,ledgerFile,repo:repoRoot,workflowId:WORKFLOW,report,policy:ON,wake:spy.wake,notify:spy.notify});
    assert.deepEqual(again,{accepted:false,why:'already-answered'});
    assert.equal(events(ledger,'ask-answered').length,1,'an answered ask is never answered twice');
  });
});

test('the text-marked recommendation is accepted, and the default wake reports a kernel it cannot reach',async t=>{
  await withLedger(t,async({repoRoot,ledger,ledgerFile})=>{
    seedWorkflow(ledger,{id:WORKFLOW,state:{phase:'running'}});
    const report=seedAsk(ledger,{dispatchId:'ctx_refund',question:TEXT_MARKED});
    const notified=[];
    const r=await autoAcceptAsk({ledger,ledgerFile,repo:repoRoot,workflowId:WORKFLOW,report,policy:ON,notify:async a=>{notified.push(a);return {ok:true};}});
    assert.equal(r.accepted,true);
    assert.equal(r.source,'text');
    assert.equal(r.wake.action,'kernel-signal-absent','wakeAskAnswered runs; this ledger names no kernel terminal');
    assert.equal(events(ledger,'ask-auto-accepted')[0].rule.source,'text');
    assert.equal(typeof wakeAskAnswered,'function');
  });
});

test('excluded (credential, handover, irreversible) and unrecommended asks are not auto-accepted and write nothing',async t=>{
  await withLedger(t,async({repoRoot,ledger,ledgerFile})=>{
    seedWorkflow(ledger,{id:WORKFLOW,state:{phase:'running'}});
    const cases=[
      ['ctx_secret',{text:'Dán GITHUB_OAUTH_CLIENT_SECRET vào form',options:['Dán ngay (khuyến nghị)','Để sau']},'provision.ask','excluded:credential'],
      ['ctx_account',{...RECOMMENDED,kind:'account'},'provision.ask','excluded:credential'],
      ['ctx_handover',{text:'Duyệt bàn giao?',options:['Duyệt','Góp ý','Hỏi thêm'],recommended:0,recommendedReason:'mọi kiểm tra đều xanh'},'handover.review','excluded:handover'],
      ['ctx_drop',{...RECOMMENDED,kind:'irreversible-confirmation'},'provision.ask','excluded:irreversible-confirmation'],
      ['ctx_plain',{text:'Chọn màu?',options:['Xanh','Đỏ']},'provision.ask','no-recommendation'],
    ];
    for(const [dispatchId,question,opId,why] of cases){
      const report=seedAsk(ledger,{dispatchId,question,opId});
      const spy=spies();
      const policy=opId==='handover.review'?{...ON,excludes:['handover']}:ON;
      assert.deepEqual(await autoAcceptAsk({ledger,ledgerFile,repo:repoRoot,workflowId:WORKFLOW,report,policy,wake:spy.wake,notify:spy.notify}),{accepted:false,why},dispatchId);
      assert.equal(spy.woken.length+spy.notified.length,0,dispatchId);
    }
    assert.deepEqual(events(ledger,'ask-answered'),[]);
    assert.deepEqual(events(ledger,'ask-auto-accepted'),[]);
    assert.equal(fs.existsSync(path.join(repoRoot,'.starciwork','kernel-evidence')),false,'no receipt was written');
  });
});

test('flag off (the shipped default, or a config that cannot be read) changes nothing',async t=>{
  await withLedger(t,async({repoRoot,ledger,ledgerFile})=>{
    seedWorkflow(ledger,{id:WORKFLOW,state:{phase:'running'}});
    const report=seedAsk(ledger,{dispatchId:'ctx_off',question:RECOMMENDED});
    const spy=spies();
    for(const policy of [askAutoAcceptPolicy(EXAMPLE),null])
      assert.deepEqual(await autoAcceptAsk({ledger,ledgerFile,repo:repoRoot,workflowId:WORKFLOW,report,policy,wake:spy.wake,notify:spy.notify}),{accepted:false,why:'flag-off'});
    assert.equal(spy.woken.length+spy.notified.length,0);
    assert.deepEqual(events(ledger,'ask-answered'),[]);
    assert.deepEqual(events(ledger,'ask-auto-accepted'),[]);
  });
});

/* ------------------------------------------------------------ served normally */

// Excluded and unrecommended asks never auto-accept whatever the owner's config
// says, so the real serve-ask binds its form for each of them.
const serve=(repoRoot,dispatchId)=>spawnSync(process.execPath,[SERVE_ASK,'--repo',repoRoot,'--workflow',WORKFLOW,'--dispatch',dispatchId,'--ttl','300'],
  {cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:60000,env:{...process.env,STARCI_CONNECTORS_OFF:'1'}});

test('serve-ask serves the form for a handover, a credential and an unrecommended ask',async t=>{
  await withLedger(t,async({repoRoot,ledger})=>{
    seedWorkflow(ledger,{id:WORKFLOW,state:{phase:'running'}});
    seedAsk(ledger,{dispatchId:'ctx_handover',opId:'handover.review',question:{text:'Duyệt bàn giao?',options:['Duyệt (khuyến nghị)','Góp ý','Hỏi thêm'],recommended:0,recommendedReason:'xanh'}});
    seedAsk(ledger,{dispatchId:'ctx_secret',question:{text:'Dán STRIPE_SECRET_KEY',options:['Dán (khuyến nghị)','Để sau'],recommended:0}});
    seedAsk(ledger,{dispatchId:'ctx_plain',question:{text:'Chọn màu?',options:['Xanh','Đỏ']}});
    for(const dispatchId of ['ctx_handover','ctx_secret','ctx_plain']){
      const r=serve(repoRoot,dispatchId);
      assert.equal(r.status,0,r.stderr||r.stdout);
      const out=JSON.parse(r.stdout.trim().split('\n').pop());
      assert.equal(out.autoAccepted,undefined,dispatchId);
      assert.match(out.url,/^http:\/\/127\.0\.0\.1:\d+\/a-/,dispatchId);
    }
    assert.deepEqual(events(ledger,'ask-serving').map(p=>p.dispatchId),['ctx_handover','ctx_secret','ctx_plain']);
    assert.deepEqual(events(ledger,'ask-answered'),[]);
    assert.deepEqual(events(ledger,'ask-auto-accepted'),[]);
  });
});

test('api serve-ask launches the form for a handover ask even when it carries a recommendation',async t=>{
  await withLedger(t,async({repoRoot,ledger})=>{
    seedWorkflow(ledger,{id:WORKFLOW,state:{phase:'running'}});
    seedAsk(ledger,{dispatchId:'ctx_handover',opId:'handover.review',question:{text:'Duyệt bàn giao?',options:['Duyệt','Góp ý','Hỏi thêm'],recommended:0,recommendedReason:'xanh'}});
    const r=spawnSync(process.execPath,[API,'serve-ask','--repo',repoRoot,'--workflow',WORKFLOW,'--dispatch','ctx_handover','--ttl','300','--json'],
      {cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:60000,env:{...process.env,STARCI_CONNECTORS_OFF:'1'}});
    assert.equal(r.status,0,r.stderr||r.stdout);
    const out=JSON.parse(r.stdout);
    assert.equal(out.servedBy,'scripts/kernel/serve-ask.mjs');
    assert.equal(out.autoAccepted,undefined);
    // The detached form holds the ledger open until it exits; its expired event lands just before that.
    assert.equal(await awaitExit(out.pid),true,`serve-ask pid ${out.pid} exits on its ttl`);
    assert.deepEqual(events(ledger,'ask-serving').map(p=>p.dispatchId),['ctx_handover']);
    assert.deepEqual(events(ledger,'ask-auto-accepted'),[]);
  });
});

/* ------------------------------------------------------------ telegram */

test('the owner gets one plain Telegram message naming the pick and the question, with no link',async t=>{
  await withLedger(t,async({ledger,ledgerFile,machineHome})=>{
    seedWorkflow(ledger,{id:WORKFLOW,state:{phase:'running',job:'nivo-invite'}});
    seedAsk(ledger,{dispatchId:'ctx_invite',question:RECOMMENDED});
    const text=autoAcceptedMessage({workflow:{id:WORKFLOW,title:null},question:RECOMMENDED,label:'Mời bằng email',language:'vi'});
    assert.ok(text.startsWith('Đã tự chọn phương án đề xuất: Mời bằng email — câu hỏi: Mời thành viên bằng cách nào?. Thầy muốn đổi thì trả lời lại kernel / supervisor.'),text);
    assert.doesNotMatch(text,/https?:\/\//);
    const calls=[];
    const fetchImpl=async(url,init)=>{calls.push({method:url.split('/').pop(),body:JSON.parse(init.body)});return {ok:true,status:200,json:async()=>({ok:true,result:{message_id:7}})};};
    const config={...structuredClone(EXAMPLE),language:'vi',connectors:{...structuredClone(EXAMPLE.connectors),secretsFile:null,telegram:{enabled:true,chatId:'4242'}}};
    const deps={config,env:{LOCALAPPDATA:machineHome,TELEGRAM_BOT_TOKEN:TOKEN},apiBase:'http://bot.invalid',fetchImpl,sleepImpl:async()=>{},warn:()=>{}};
    const first=await notifyAutoAccepted({ledgerFile,workflowId:WORKFLOW,dispatchId:'ctx_invite',label:'Mời bằng email'},deps);
    const second=await notifyAutoAccepted({ledgerFile,workflowId:WORKFLOW,dispatchId:'ctx_invite',label:'Mời bằng email'},deps);
    assert.equal(first.sent,1);
    assert.equal(second.skipped,'already sent','one message per ask');
    assert.equal(calls.length,1);
    assert.equal(calls[0].method,'sendMessage');
    assert.match(calls[0].body.text,/^Đã tự chọn phương án đề xuất: Mời bằng email — câu hỏi: /);
    assert.match(calls[0].body.text,/nivo-invite/);
    assert.equal((await notifyAutoAccepted({ledgerFile,workflowId:WORKFLOW,dispatchId:'ctx_x',label:'x'},{...deps,env:{...deps.env,STARCI_CONNECTORS_OFF:'1'}})).skipped,'STARCI_CONNECTORS_OFF');
  });
});
