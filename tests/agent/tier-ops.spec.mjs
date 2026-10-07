import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseYaml} from '../../engine/yaml.mjs';
import {configuredAllocationPolicy,parseAllocationGrant,validateConfig} from '../../engine/config.mjs';
import {loadRuntimes} from '../../scripts/agent/models.mjs';
import {fakePoolSelection as selectPool} from '../helpers/fake-admission.mjs';
import {tierHistory} from '../../scripts/agent/tier-history.mjs';
import {isFixtureLedgerPath,machineLedgerFiles} from '../../scripts/machine/ledger-files.mjs';
import {openLedger} from '../../engine/db/ledger.mjs';
import {withLedger,seedWorkflow,sameDriveTmp} from '../helpers/ledger-fixture.mjs';

// An operation takes the tier of its difficulty (modules/models/tiers.yaml): the chain, the balance over recent picks, the
// image tier of drawing ops and Devin's explicit grant gate. These specs hold that contract on the shipped data.
const ROOT=path.resolve(import.meta.dirname,'..', '..');
const read=file=>parseYaml(fs.readFileSync(path.join(ROOT,file),'utf8'));
const runtimes=loadRuntimes(path.join(ROOT,'modules','models'));
const route=(opts)=>selectPool({runtimes,capacity:{},scopeId:'tier-ops',...opts});

test('live pool selection refuses a concrete opaque only-model and accepts the provider alone',()=>{
  const options={kind:'backend.implement',difficulty:'medium'};
  const required=route({...options,bias:{only:[{provider:'devin',model:'swe-2-max'}]}});
  assert.equal(required.admission.reason,'bias-empties-chain');
  assert.ok(required.error&&!required.target,'another available provider cannot satisfy an only bias');
  assert.ok(required.admission.rejected.find(row=>row.id==='devin/swe-2-max').codes.includes('only-model-unverifiable'));
  const provider=route({...options,bias:{only:[{provider:'devin'}]}});
  assert.equal(provider.target,'devin-agent');
  assert.equal(provider.admission.selected.modelAuthority,'configured-logical-runtime');
});

test('an operation takes the chain of its difficulty tier and the first member with tokens',()=>{
  const expected={easy:['low','devin-agent','swe-2-max'],medium:['medium','devin-agent','swe-2-max'],hard:['high','claude-agent','claude-sonnet-5-5'],insane:['frontier','claude-agent','claude-opus-5-5']};
  for(const [difficulty,[tier,target,modelId]] of Object.entries(expected)){
    const r=route({kind:'backend.scaffold',difficulty});
    assert.deepEqual([r.tier,r.target,r.modelId],[tier,target,modelId],difficulty);
    assert.equal(r.pick.chosen.by,'chain-order');
  }
  assert.deepEqual(route({kind:'backend.scaffold',difficulty:'easy'}).chain,['devin/swe-2-max','codex/gpt-6-luna']);
  assert.deepEqual(route({kind:'backend.scaffold',difficulty:'hard'}).chain,['claude/claude-sonnet-5-5','codex/gpt-6.1-sol']);
});

test('a drawing op takes the tier of its difficulty like every core op: high from its hard floor, frontier at insane, never the call tier',()=>{
  for(const kind of ['interface.draw','interface.asset','brand.decide']){
    // interface.draw needs the browser-dom host tool (Playwright capture), which Claude's card lacks: its high chain drops to Sol.
    const [target,modelId]=kind==='interface.draw'?['codex-agent','gpt-6.1-sol']:['claude-agent','claude-sonnet-5-5'];
    for(const difficulty of ['easy','medium','hard']){
      const r=route({kind,difficulty});
      assert.deepEqual([r.tier,r.target,r.modelId],['high',target,modelId],`${kind} ${difficulty}`);
      assert.deepEqual(r.chain,['claude/claude-sonnet-5-5','codex/gpt-6.1-sol']);
    }
    assert.equal(route({kind,difficulty:'insane'}).tier,'frontier',kind);
  }
});

test('a streak of three picks of the head yields the fourth to the next member; a share over 70 percent yields too',()=>{
  const head='devin/swe-2-max',next='codex/gpt-6.1-sol';
  const base={kind:'backend.implement',difficulty:'medium'};
  assert.equal(route({...base,history:{recent:[head,head],running:{}}}).target,'devin-agent');
  const streak=route({...base,history:{recent:[head,head,head],running:{}}});
  assert.equal(streak.target,'codex-agent');
  assert.equal(streak.pick.chosen.by,'balance');
  assert.match(streak.pick.balance.reason,/3 times in a row/);
  const shared=route({...base,history:{recent:[],running:{[head]:8,[next]:2}}});
  assert.equal(shared.target,'codex-agent');
  assert.match(shared.pick.balance.reason,/80% of the running seats/);
  assert.equal(route({...base,history:{recent:[],running:{[head]:7,[next]:3}}}).target,'devin-agent','70 percent is not over the share');
  const biased=route({...base,history:{recent:[head,head,head],running:{}},bias:{prefer:[{provider:'devin'}]}});
  assert.equal(biased.target,'devin-agent','a bias beats balance');
});

test('a pool id string in a bias names the pool; a lineage demotion moves a pool last and reports when it is taken anyway',()=>{
  const base={kind:'backend.implement',difficulty:'medium'};
  assert.equal(route({...base,bias:{avoid:['devin-agent']}}).target,'codex-agent');
  assert.equal(route({...base,bias:{only:['codex-agent']}}).target,'codex-agent');
  const demoted=route({...base,lineage:{demote:['devin-agent'],exclude:[]}});
  assert.deepEqual([demoted.target,demoted.chain.at(-1),demoted.lineage.demotedTaken],['codex-agent','devin/swe-2-max',false]);
  const only=route({...base,bias:{only:['devin-agent']},lineage:{demote:['devin-agent'],exclude:[]}});
  assert.deepEqual([only.target,only.lineage.demotedTaken],['devin-agent',true]);
});

test('Devin opens by an owner grant: none declared keeps it ungated, a declared list gates it',()=>{
  const medium={kind:'backend.implement',difficulty:'medium'};
  assert.equal(route(medium).target,'devin-agent','no grants passed: ungated routing');
  const closed=route({...medium,grants:{}});
  assert.notEqual(closed.target,'devin-agent');
  assert.match(closed.rejected.find(x=>x.target==='devin/swe-2-max').reasons.join(';'),/owner-grant|grant/i);
  const grants={'devin-agent':{slots:2,roles:['implement','verify','write']}};
  assert.equal(route({...medium,grants}).target,'devin-agent');
  const capped=route({...medium,grants,capacity:{'devin-agent':{running:2}}});
  assert.notEqual(capped.target,'devin-agent','a pool at its granted slots falls to the next member');
  const noWrite=route({kind:'docs.author',difficulty:'medium',grants:{'devin-agent':{slots:10,roles:['implement']}}});
  assert.notEqual(noWrite.target,'devin-agent','a grant that does not cover the role keeps Devin out');
  // The shipped default grant opens Devin for every workflow at its maxParallel.
  const example=configuredAllocationPolicy(validateConfig(read('config.example.yaml')));
  assert.deepEqual(example.grants,{'devin-agent':{slots:10,roles:['implement','verify','write']}});
  assert.equal(runtimes.runtimes['devin-agent'].maxParallel,10);
  assert.deepEqual(runtimes.runtimes['devin-agent'].roles,['implement','verify','write']);
});

test('config.yaml allocation validates grants and refuses every removed key naming its new place',()=>{
  const base=read('config.example.yaml');
  const withAllocation=allocation=>({...base,allocation});
  const ok=configuredAllocationPolicy(validateConfig(withAllocation({grants:['devin-agent=4@implement+verify']})));
  assert.deepEqual(ok.grants['devin-agent'],{slots:4,roles:['implement','verify']});
  const bare=configuredAllocationPolicy(validateConfig(withAllocation({})));
  assert.equal(bare.grants,null);
  for(const [bad,why] of [
    [{grants:'devin-agent=2@implement'},/must be a list/],
    [{grants:['devin-agent=2']},/is not "<pool>=<slots>@<role>/],
    [{grants:['devin-agent=11@implement']},/slots must be 1..10/],
    [{grants:['devin-agent=2@plan']},/does not serve role plan/],
    [{grants:['devin-agent=2@implement','devin-agent=3@verify']},/more than once/],
    [{bogus:true},/allocation must be/],
  ])assert.throws(()=>validateConfig(withAllocation(bad)),why,JSON.stringify(bad));
  for(const [key,value,place] of [
    ['shares',{'claude-agent':1},/allocation\.shares is removed \(the picker balances by models\.balance/],
    ['windowHours',12,/allocation\.windowHours is removed/],
    ['preferredProvider','codex',/allocation\.preferredProvider is removed \(an owner preference is a goal routing bias/],
    ['policy','balanced',/allocation\.policy is removed/],
    ['mode','adaptive',/allocation\.mode is removed/],
  ])assert.throws(()=>validateConfig(withAllocation({[key]:value})),place,key);
  assert.deepEqual(parseAllocationGrant('devin-agent=10@implement+verify+write'),{pool:'devin-agent',slots:10,roles:['implement','verify','write']});
  assert.equal(parseAllocationGrant('devin-agent@implement'),null);
});

const T=Date.now();
const H=3600000;
const job=(jobId,{op,tier='medium',member=null,status='succeeded',createdAt})=>({
  jobId,opId:op,kind:'op',status,createdAt,updatedAt:createdAt+60000,
  payload:{opId:op,records:[],owned_paths:[],...(member?{pick:{tier,member},routedAt:createdAt}:{})},
});

test('the recent picks of a tier come from routed op jobs; a queued route counts as running while its hold lasts',t=>{
  withLedger(t,({ledger,ledgerFile})=>{
    seedWorkflow(ledger,{id:'wf-balance',now:T,jobs:[
      job('a',{op:'backend.implement',member:'devin/swe-2-max',createdAt:T-2*H}),
      job('b',{op:'backend.implement',member:'devin/swe-2-max',status:'queued',createdAt:T-60000}),
      job('c',{op:'backend.implement',member:'codex/gpt-6.1-sol',createdAt:T-3*H}),
      job('d',{op:'backend.implement',createdAt:T-H}),// never routed
      job('e',{op:'backend.implement',tier:'high',member:'claude/claude-sonnet-5-5',createdAt:T-H}),// another tier
    ]});
    const r=tierHistory({tier:'medium',db:ledger.db,ledgerFile,machine:false,now:T,routeHoldMs:120000});
    assert.deepEqual(r.recent,['devin/swe-2-max','devin/swe-2-max','codex/gpt-6.1-sol']);
    assert.deepEqual(r.running,{'devin/swe-2-max':1});
    assert.deepEqual(tierHistory({tier:'medium',db:ledger.db,ledgerFile,machine:false,now:T,routeHoldMs:0}).running,{});
    assert.deepEqual(tierHistory({tier:'high',db:ledger.db,ledgerFile,machine:false,now:T}).recent,['claude/claude-sonnet-5-5']);
  });
});

test('a fixture-shaped path is never a product ledger: temp roots and fixture/fixtures directories',()=>{
  const T=os.tmpdir().replace(/\\/g,'/'),DRV=path.parse(os.tmpdir()).root.replace(/\\/g,'/'),env={TEMP:T,TMP:T};
  assert.equal(isFixtureLedgerPath(`${DRV}fixture/.starciwork/runtime.sqlite`,{env}),true,'the stale fixture-root ledger');
  assert.equal(isFixtureLedgerPath(`${DRV}work/tests/fixtures/repo/.starciwork/runtime.sqlite`,{env}),true);
  assert.equal(isFixtureLedgerPath(`${T}/w1-x/repo/.starciwork/runtime.sqlite`,{env}),true);
  assert.equal(isFixtureLedgerPath(path.join(os.tmpdir(),'starci-x','.starciwork','runtime.sqlite')),true);
  assert.equal(isFixtureLedgerPath(`${DRV}Repositories/shop-be/.starciwork/runtime.sqlite`,{env}),false);
  assert.equal(isFixtureLedgerPath(`${DRV}Repositories/fixture-shop/.starciwork/runtime.sqlite`,{env}),false,'only a whole segment names a fixture');
  assert.equal(isFixtureLedgerPath(null,{env}),false);
});

test('the machine scan counts routed picks of registered product ledgers only: never a fixture path, a temp path or a missing file',t=>{
  // Everything lives under a temp root the spec made, on the runtime's drive (not os.tmpdir(), which the scan
  // skips), and the registry is injected: the host's machine.sqlite is never read or written.
  withLedger(t,({root,ledger,ledgerFile,machine,machineFile,track})=>{
    // The scan's temp directory is whatever os.tmpdir() answers: a spec-owned one, so the fixture root (also a temp dir on a host with one
    // filesystem tree) is not under it, and the temp ledger is.
    const scanTemp=fs.mkdtempSync(path.join(os.tmpdir(),'starci-balance-scan-'));
    const tempRoot=fs.mkdtempSync(path.join(scanTemp,'starci-balance-temp-'));
    const saved=['TMPDIR','TEMP','TMP'].map(key=>[key,process.env[key]]);
    t.after(()=>{for(const [key,value] of saved){if(value===undefined)delete process.env[key];else process.env[key]=value;}fs.rmSync(scanTemp,{recursive:true,force:true,maxRetries:20,retryDelay:25});});
    // A ledger opened by file path (not ledgerFileFor) seeds no meta.repo_root; registerLedger refuses a
    // new row without one (registry-no-repo-root), so the fixture names its root at open.
    const other=(dir,id,member)=>{
      const file=path.join(dir,'.starciwork','runtime.sqlite');
      fs.mkdirSync(path.dirname(file),{recursive:true});
      const handle=track(openLedger({file,machine,repoRoot:dir}));
      seedWorkflow(handle,{id,now:T,jobs:[job(`${id}-1`,{op:'backend.implement',member,createdAt:T-H})]});
      return file;
    };
    const product=other(path.join(root,'product'),'wf-product','claude/claude-sonnet-5-5');
    const fixture=other(path.join(root,'fixture'),'wf-fixture','codex/gpt-6.1-sol');
    const temp=other(path.join(tempRoot,'temp-repo'),'wf-temp','codex/gpt-6.1-sol');
    machine.registerLedger({file:path.join(root,'gone','.starciwork','runtime.sqlite'),ledgerId:'ledger-gone',repoRoot:path.join(root,'gone')});
    seedWorkflow(ledger,{id:'wf-repo',now:T,jobs:[job('r-1',{op:'backend.implement',member:'devin/swe-2-max',createdAt:T-H})]});

    for(const [key] of saved)process.env[key]=scanTemp;
    const registered=machine.db.prepare('SELECT file FROM ledgers').all().map(row=>path.resolve(row.file));
    assert.equal(registered.length,5,'the repo ledger, product, fixture, temp and the missing ledger are all registered');
    const scanned=machineLedgerFiles({machineFile,exclude:[ledgerFile]}).map(file=>path.resolve(file).toLowerCase());
    assert.deepEqual(scanned,[fs.realpathSync(product).toLowerCase()]);
    assert.equal(scanned.includes(path.resolve(fixture).toLowerCase()),false,'a fixture directory never counts');
    assert.equal(scanned.includes(path.resolve(temp).toLowerCase()),false,'a temp ledger never counts');

    const r=tierHistory({tier:'medium',db:ledger.db,ledgerFile,machineFile,now:T});
    assert.deepEqual([...r.recent].sort(),['claude/claude-sonnet-5-5','devin/swe-2-max'],'repo plus the one product ledger; no fixture pick');

    // A ledger that is itself a fixture is balanced on its own jobs only.
    const own=track(openLedger({file:fixture}));
    assert.deepEqual(tierHistory({tier:'medium',db:own.db,ledgerFile:fixture,machineFile,now:T}).recent,['codex/gpt-6.1-sol']);
  },{parentDir:sameDriveTmp()});
});
