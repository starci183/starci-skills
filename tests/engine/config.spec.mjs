import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {OWNER_CONFIG_WITHIN_ENV,inspectOwnerConfig,configuredAllocationPolicy,DEBUG_LOOP_DEFAULTS,debugLoopSettings,defaultParallelGear,durationMs,loadConfig,parallelGear,runtimeProfile,slicingGears,validateConfig} from '../../engine/config.mjs';
import {effectiveTiers,shippedTiers} from '../../engine/model-config.mjs';
import {parseYaml,stringifyYaml} from '../../engine/yaml.mjs';
import {winPath,slashPath} from '../fixtures/win-path.mjs';
// config.example.yaml is the shipped default — the installer seeds config.yaml from it verbatim, so it
// is what the seeded config.yaml (the installer copies the example) must produce. The spec reads it rather than keeping a copy.
const EXAMPLE_MODELS=structuredClone(parseYaml(fs.readFileSync(new URL('../../config.example.yaml',import.meta.url),'utf8')).models);
// connectors is its own closed block (tests/connectors/connectors.spec.mjs); here it only has to round-trip.
const EXAMPLE_CONNECTORS=parseYaml(fs.readFileSync(new URL('../../config.example.yaml',import.meta.url),'utf8')).connectors;
// reconciler is its own closed block too (controller shadow modes are reconciler specs' contract); read it shipped.
const EXAMPLE_RECONCILER=parseYaml(fs.readFileSync(new URL('../../config.example.yaml',import.meta.url),'utf8')).reconciler;
const EXAMPLE_DEBUG_LOOP=parseYaml(fs.readFileSync(new URL('../../config.example.yaml',import.meta.url),'utf8')).debugLoop;
const expected=()=>({language:'vi',model:null,effort:'medium',launchTrust:null,retention:null,kernel:{effort:'high'},parallel:{gear:1},supervisor:{pollIntervalMs:null,repos:[]},delegation:null,budgets:{maxOps:null},allocation:{grants:['devin-agent=10@implement+verify+write']},models:structuredClone(EXAMPLE_MODELS),connectors:structuredClone(EXAMPLE_CONNECTORS),asks:{autoAcceptRecommended:false,excludes:['credential','irreversible-confirmation','handover']},uat:{maxConcurrent:10},orca:{maxWorkerDepth:4},debugLoop:structuredClone(EXAMPLE_DEBUG_LOOP),reconciler:structuredClone(EXAMPLE_RECONCILER),sonar:{organization:null},release:{suite:'local'}});
test('debugLoop owns the cadence of the chat loop; the removed debug and coreDebug keys are refused by name',()=>{
  assert.doesNotThrow(()=>validateConfig(expected()));
  assert.throws(()=>validateConfig({...expected(),debugLoop:{interval:'0m',worktreeLimit:40}}),/debugLoop.interval/);
  assert.throws(()=>validateConfig({...expected(),debugLoop:{interval:'10m',worktreeLimit:0}}),/debugLoop.worktreeLimit/);
  assert.throws(()=>validateConfig({...expected(),debugLoop:{interval:'10m',model:'gpt-6.1-sol'}}),/debugLoop has unknown key model/);
  assert.throws(()=>validateConfig({...expected(),debug:true}),/debug is removed \(the debug watcher is started by the \/starci skill/);
  assert.throws(()=>validateConfig({...expected(),debug:false}),/debug is removed/);
  assert.throws(()=>validateConfig({...expected(),coreDebug:{interval:'10m',worktreeLimit:40}}),/coreDebug is removed \(the debug watcher is a \/loop of the calling chat, not a seat/);
  const retired=expected();retired.claudeDebug={interval:'10m',worktreeLimit:40};
  assert.throws(()=>validateConfig(retired),{name:'Error',message:/^Invalid config\.yaml:.*closed set of config blocks/});
});

test('debugLoopSettings reads the authored keys and falls back to the shipped defaults per key',()=>{
  const example=expected();
  assert.deepEqual(debugLoopSettings(example),{...EXAMPLE_DEBUG_LOOP,intervalMs:durationMs(EXAMPLE_DEBUG_LOOP.interval)});
  assert.deepEqual(EXAMPLE_DEBUG_LOOP,DEBUG_LOOP_DEFAULTS);
  assert.deepEqual(debugLoopSettings({...example,debugLoop:{interval:'7s',worktreeLimit:2}}),{interval:'7s',intervalMs:7000,worktreeLimit:2});
  assert.deepEqual(debugLoopSettings({...example,debugLoop:{interval:'2h'}}),{interval:'2h',intervalMs:7200000,worktreeLimit:DEBUG_LOOP_DEFAULTS.worktreeLimit});
  const absent=structuredClone(example);delete absent.debugLoop;
  assert.deepEqual(debugLoopSettings(absent),{interval:'10m',intervalMs:600000,worktreeLimit:40});
  assert.deepEqual(debugLoopSettings({...absent,debugLoop:null}),debugLoopSettings(absent));
  assert.throws(()=>debugLoopSettings({...example,debugLoop:{interval:'7'}}),/debugLoop.interval/);
});
test('local config initializes the shipped tier defaults and refuses removed keys, unknown tiers, members and shapes',()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-config-'));try{fs.copyFileSync(new URL('../../config.example.yaml',import.meta.url),path.join(root,'config.example.yaml'));assert.deepEqual((fs.copyFileSync(path.join(root,'config.example.yaml'),path.join(root,'config.yaml')),loadConfig(root)),expected());const effective=effectiveTiers(loadConfig(root),runtimeProfile());assert.deepEqual([effective.seats.kernelManager,effective.seats.supervisor,effective.seats.kernel],['frontier','frontier','high']);assert.deepEqual(effective.tiers.frontier.map(member=>member.agent),['claude','codex'],'member order is the route order');const reordered=expected();reordered.models={tiers:{frontier:[{agent:'codex',model:'gpt-6.1-sol'},{agent:'claude',model:'claude-opus-5-5'}]}};assert.deepEqual(effectiveTiers(validateConfig(reordered),runtimeProfile()).tiers.frontier.map(member=>member.agent),['codex','claude'],'the owner reorders a chain by writing it');const extra=expected();extra.models={tiers:{cheap:[{agent:'codex',model:'gpt-6-luna',effort:'low'}]}};assert.deepEqual(Object.keys(effectiveTiers(validateConfig(extra),runtimeProfile()).tiers).sort(),['cheap','frontier','high','imagegen','low','medium'],'a new tier is a line of config');const badModel=expected();badModel.models={tiers:{high:[{agent:'claude',model:'unknown-model'}]}};assert.throws(()=>validateConfig(badModel),/model unknown-model is not declared by agent claude/);const wrongAgent=expected();wrongAgent.models={tiers:{high:[{agent:'claude',model:'gpt-6.1-sol'}]}};assert.throws(()=>validateConfig(wrongAgent),/model gpt-6\.1-sol is not declared by agent claude/);const duplicate=expected();duplicate.models={tiers:{high:[{agent:'claude',model:'claude-opus-5-5'},{agent:'claude',model:'claude-opus-5-5'}]}};assert.throws(()=>validateConfig(duplicate),/names each member once/);const empty=expected();empty.models={tiers:{high:[]}};assert.throws(()=>validateConfig(empty),/non-empty ordered list/);const unknownSeatTier=expected();unknownSeatTier.models={seats:{kernel:'no-such-tier'}};assert.throws(()=>validateConfig(unknownSeatTier),/seats\.kernel names tier no-such-tier/);const unknownKey=expected();unknownKey.models={selection:'quota-aware'};assert.throws(()=>validateConfig(unknownKey),/models\.selection is removed/);const unknownModelsKey=expected();unknownModelsKey.models={rescuer:'high'};assert.throws(()=>validateConfig(unknownModelsKey),/unknown keys are refused/);const badBalance=expected();badBalance.models={balance:{maxStreak:0}};assert.throws(()=>validateConfig(badBalance),/maxStreak must be an integer >= 1/);badBalance.models={balance:{maxSharePercent:101}};assert.throws(()=>validateConfig(badBalance),/maxSharePercent/);const badUsage=expected();badUsage.models={usage:{reservePercent:96}};assert.throws(()=>validateConfig(badUsage),/reservePercent <= biasPercent < exhaustedPercent/);const custom={...expected(),language:'en',model:'test-host-model'};fs.writeFileSync(path.join(root,'config.yaml'),stringifyYaml(custom));assert.deepEqual(loadConfig(root),custom);fs.writeFileSync(path.join(root,'config.yaml'),'null\n');assert.throws(()=>loadConfig(root),/Invalid config/);}finally{fs.rmSync(root,{recursive:true,force:true});}});
test('top-level supervisor/validator/critique sections are refused as unknown keys',()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-config-old-'));try{const old=expected();old.supervisor={runtimes:['codex-agent','claude-agent']};old.critique={runtimes:['claude-agent','codex-agent']};fs.writeFileSync(path.join(root,'config.yaml'),stringifyYaml(old));assert.throws(()=>loadConfig(root),/Invalid config/);}finally{fs.rmSync(root,{recursive:true,force:true});}});
test('every key an earlier config shape carried is refused naming its new place',()=>{for(const [mutate,pattern] of [[draft=>{draft.models={pools:{'sol-opus':['claude-agent','codex-agent']}};},/models\.pools is removed \(tiers are ordered member chains/],[draft=>{draft.models={nonOperation:{planner:'sol-opus'}};},/models\.nonOperation is removed \(planner, validator and kernelManager take the frontier tier/],[draft=>{draft.models={selection:'quota-aware'};},/models\.selection is removed/],[draft=>{draft.kernel={group:[{agent:'claude'},{agent:'codex'}]};},/kernel\.group is removed \(the Kernel takes the high tier/],[draft=>{draft.supervisor={...draft.supervisor,kernel:{group:[{agent:'claude'}]}};},/supervisor\.kernel\.group is removed \(the Supervisor takes the frontier tier/],[draft=>{draft.allocation={...draft.allocation,shares:{'devin-agent':35,'claude-agent':20,'codex-agent':10}};},/allocation\.shares is removed/],[draft=>{draft.allocation={...draft.allocation,windowHours:24};},/allocation\.windowHours is removed/],[draft=>{draft.allocation={...draft.allocation,preferredProvider:'codex'};},/allocation\.preferredProvider is removed/],[draft=>{draft.allocation={...draft.allocation,policy:'balanced'};},/allocation\.policy is removed/],[draft=>{draft.allocation={...draft.allocation,mode:'adaptive'};},/allocation\.mode is removed/]]){const draft=expected();mutate(draft);assert.throws(()=>validateConfig(draft),pattern);}const several=expected();several.allocation={...several.allocation,shares:{},policy:'balanced'};assert.throws(()=>validateConfig(several),/allocation\.shares is removed.*allocation\.policy is removed/,'every removed key of one file is named at once');});
test('a lone config.json is not honored — config.yaml is the only owner file',()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-config-json-'));try{fs.writeFileSync(path.join(root,'config.json'),JSON.stringify({language:'vi',model:null,effort:'medium',models:{}}));assert.throws(()=>loadConfig(root),/Missing config\.example\.yaml/,'config.json must not be read; with no example file the loader fails closed');}finally{fs.rmSync(root,{recursive:true,force:true});}});
test('relocated installed config reads the source model registry',async()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-config-installed-'));try{for(const file of ['engine/config.mjs','engine/secrets.mjs','engine/runtime-root.mjs','engine/yaml.mjs','engine/plain-object.mjs','engine/by-code-unit.mjs','engine/invalid-config.mjs','engine/orca-config.mjs','engine/model-config.mjs','engine/removed-vocabulary.mjs','engine/resources-config.mjs','engine/sonar-config.mjs','engine/release-config.mjs','config.example.yaml','modules/models/runtimes.yaml','modules/models/registry.yaml','modules/models/tiers.yaml','modules/kernel/removed-vocabulary.yaml']){const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(new URL(`../../${file}`,import.meta.url),target);}const installed=await import(`${new URL(`file:///${path.join(root,'engine/config.mjs').replaceAll('\\','/')}`)}?fixture=${Date.now()}`);assert.deepEqual(installed.loadConfig(root).models,{});const tiers=(await import(`${new URL(`file:///${path.join(root,'engine/model-config.mjs').replaceAll('\\','/')}`)}?fixture=${Date.now()}`)).shippedTiers();assert.deepEqual([tiers.seats.kernelManager,tiers.tiers.frontier[0].agent],['frontier','claude']);assert.equal(fs.existsSync(path.join(root,'model','runtimes.yaml')),false);}finally{fs.rmSync(root,{recursive:true,force:true});}});

// parallel.gear is the owner's ONE parallelism knob: an integer from
// modules/models/runtimes.yaml allocation.slicing.gears, defaulting to the first
// declared gear when the block is absent, failing closed on anything else.
test('parallel.gear accepts a declared gear, defaults to the first one and fails closed on the rest',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-config-gear-'));
  try{
    fs.copyFileSync(new URL('../../config.example.yaml',import.meta.url),path.join(root,'config.example.yaml'));
    const gears=slicingGears();
    assert.deepEqual(gears,[1,2],'the declared gear vocabulary is data in runtimes.yaml');
    assert.equal(defaultParallelGear(),1);
    const base=(fs.copyFileSync(path.join(root,'config.example.yaml'),path.join(root,'config.yaml')),loadConfig(root));
    assert.deepEqual(base.parallel,{gear:1},'the shipped example ships the owner knob at gear 1');
    assert.equal(parallelGear(base),1);
    for(const gear of gears){
      const geared={...base,parallel:{gear}};
      fs.writeFileSync(path.join(root,'config.yaml'),stringifyYaml(geared));
      assert.equal(parallelGear(loadConfig(root)),gear,`gear ${gear} is declared and must load`);
    }
    const absent={...base};
    delete absent.parallel;
    fs.writeFileSync(path.join(root,'config.yaml'),stringifyYaml(absent));
    assert.equal(parallelGear(loadConfig(root)),defaultParallelGear(),'an absent parallel block is the first declared gear, not an error');
    assert.throws(()=>validateConfig({...base,parallel:{gear:3}}),/not declared by modules\/models\/runtimes\.yaml/,'an undeclared gear fails closed');
    assert.throws(()=>validateConfig({...base,parallel:{gear:'2'}}),/parallel must be \{gear: <integer>\}/);
    assert.throws(()=>validateConfig({...base,parallel:{gear:1,agents:6}}),/parallel must be \{gear: <integer>\}/,'the knob is one key; an agent count is runtimes.yaml data');
    assert.throws(()=>validateConfig({...base,gear:2}),/Invalid config/,'a top-level gear is an unknown key');
    fs.writeFileSync(path.join(root,'config.yaml'),stringifyYaml({...base,parallel:{gear:9}}));
    assert.throws(()=>loadConfig(root),/parallel\.gear 9/,'loadConfig must not reinterpret an undeclared gear');
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('allocation holds grants only: the shipped default grants Devin and every balance or preference key is gone',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-config-providers-'));
  try{
    fs.copyFileSync(new URL('../../config.example.yaml',import.meta.url),path.join(root,'config.example.yaml'));
    const base=(fs.copyFileSync(path.join(root,'config.example.yaml'),path.join(root,'config.yaml')),loadConfig(root));
    assert.deepEqual(configuredAllocationPolicy(base),{grants:{'devin-agent':{slots:10,roles:['implement','verify','write']}},source:'allocation'},'the shipped default grants Devin and nothing else');
    const none={...base,allocation:undefined};delete none.allocation;
    assert.deepEqual(configuredAllocationPolicy(none),{grants:null,source:'default'},'no allocation block: grant-gated pools stay ungated');
    assert.throws(()=>validateConfig({...base,allocation:{preferredProvider:'openai'}}),/allocation\.preferredProvider is removed/);
    assert.throws(()=>validateConfig({...base,allocation:{mode:'chain',preferredProvider:'codex'}}),/allocation\.mode is removed/);
    assert.throws(()=>validateConfig({...base,providers:['codex']}),/Invalid config/,'a providers list is an unknown key, not an allocation source');
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('supervisor.pollIntervalMs is an owner key: an integer of at least a minute, or null', async () => {
  const { validateConfig } = await import('../../engine/config.mjs');
  const { parseYaml } = await import('../../engine/yaml.mjs');
  const fs = await import('node:fs');
  const base = parseYaml(fs.readFileSync(new URL('../../config.example.yaml', import.meta.url), 'utf8'));
  assert.doesNotThrow(() => validateConfig({ ...base, supervisor: { pollIntervalMs: 600000 } }));
  assert.doesNotThrow(() => validateConfig({ ...base, supervisor: { pollIntervalMs: null } }));
  assert.throws(() => validateConfig({ ...base, supervisor: { pollIntervalMs: 5000 } }), /supervisor/);
  assert.throws(() => validateConfig({ ...base, supervisor: { cadence: 600000 } }), /supervisor/);
});

test('supervisor.repos names the ledgers resume-all resumes: a list of repository paths, or null', async () => {
  const { validateConfig } = await import('../../engine/config.mjs');
  const { parseYaml } = await import('../../engine/yaml.mjs');
  const fs = await import('node:fs');
  const base = parseYaml(fs.readFileSync(new URL('../../config.example.yaml', import.meta.url), 'utf8'));
  assert.deepEqual(base.supervisor.repos, [], 'the example resumes no ledger until the owner lists one');
  assert.doesNotThrow(() => validateConfig({ ...base, supervisor: { pollIntervalMs: null, repos: ['../shop-be', process.cwd()] } }));
  assert.doesNotThrow(() => validateConfig({ ...base, supervisor: { repos: null } }));
  assert.throws(() => validateConfig({ ...base, supervisor: { repos: '../shop-be' } }), /supervisor\.repos/);
  assert.throws(() => validateConfig({ ...base, supervisor: { repos: ['  '] } }), /supervisor\.repos/);
});

test('the shipped example validates on the current catalog and a config naming a removed pool or an unknown model is refused',()=>{
  const example=parseYaml(fs.readFileSync(new URL('../../config.example.yaml',import.meta.url),'utf8'));
  assert.equal(validateConfig(example),example);
  assert.deepEqual(example.kernel,{effort:'high'},'the shipped kernel pins nothing: it takes the high tier of tiers.yaml');
  assert.deepEqual(example.models,{},'the shipped models block overrides nothing: tiers.yaml owns the defaults');
  assert.equal(Object.hasOwn(example.allocation,'shares'),false);
  const removed=expected();
  removed.models={pools:{'fable-astra':['claude-fable','codex-agent']},nonOperation:{planner:'fable-astra',kernelManager:'fable-astra',validator:'fable-astra'}};
  assert.throws(()=>validateConfig(removed),/models\.pools is removed.*models\.nonOperation is removed/,'a pool-shaped models block is refused as removed');
  const fable=expected();
  fable.models={tiers:{frontier:[{agent:'claude',model:'claude-fable'},{agent:'codex',model:'gpt-6.1-sol'}]}};
  assert.throws(()=>validateConfig(fable),/model claude-fable is not declared by agent claude/,'a removed model is refused in a tier chain');
});

test('kernel is a seat pin {agent?, model?, effort?}: the bias only over the high tier, never a group',()=>{
  const base=expected();
  const withKernel=kernel=>({...base,kernel});
  for(const pin of [{agent:'codex',model:'gpt-6.1-sol',effort:'high'},{model:'claude-opus-5-5'},{agent:'claude'},{agent:null,model:null,effort:null},{effort:'high'}])
    assert.doesNotThrow(()=>validateConfig(withKernel(pin)),JSON.stringify(pin));
  const refused=[
    [{agent:'gemini'},/kernel\.agent gemini is not declared by a runtime/],
    [{agent:'codex',effort:'warp'},/kernel\.effort must use the effort vocabulary/],
    [{agent:'codex',pool:'think'},/kernel must be \{agent\?, model\?, effort\?\}/],
    [{agent:''},/kernel must be \{agent\?, model\?, effort\?\}/],
    [{agent:7},/kernel must be \{agent\?, model\?, effort\?\}/],
  ];
  for(const [kernel,pattern] of refused)assert.throws(()=>validateConfig(withKernel(kernel)),pattern,JSON.stringify(kernel));
  assert.throws(()=>validateConfig(withKernel({group:[{agent:'claude'}]})),/kernel\.group is removed/);
});

test('the Supervisor seat takes the same pin shape as the Kernel; a group is removed',()=>{
  const base=expected(),withSeat=kernel=>({...base,supervisor:{...base.supervisor,kernel}});
  const pin={agent:'claude',model:'claude-opus-5-5',effort:'high'};
  assert.deepEqual(validateConfig(withSeat(pin)).supervisor.kernel,pin);
  for(const bad of [{agent:'gemini'},{effort:'warp'},{agent:'claude',pool:'think'},{model:''}])
    assert.throws(()=>validateConfig(withSeat(bad)),/supervisor\.kernel/,JSON.stringify(bad));
  assert.throws(()=>validateConfig(withSeat({group:[{agent:'claude'}]})),/supervisor\.kernel\.group is removed/);
});

test('delegation is an owner key: a named delegate answers asks until a time, and expires', async () => {
  const { validateConfig, activeDelegation } = await import('../../engine/config.mjs');
  const { parseYaml } = await import('../../engine/yaml.mjs');
  const fs = await import('node:fs');
  const base = parseYaml(fs.readFileSync(new URL('../../config.example.yaml', import.meta.url), 'utf8'));
  assert.equal(base.delegation, null, 'the example ships with no delegation');
  const live = { ...base, delegation: { asks: 'supervisor', until: '2999-01-01T00:00:00Z', excludes: ['credentials'] } };
  assert.doesNotThrow(() => validateConfig(live));
  assert.deepEqual(activeDelegation(live), { asks: 'supervisor', until: '2999-01-01T00:00:00Z', excludes: ['credentials'], note: null });
  assert.equal(activeDelegation({ ...base, delegation: { asks: 'supervisor', until: '2000-01-01T00:00:00Z' } }), null, 'an expired delegation is not active');
  assert.throws(() => validateConfig({ ...base, delegation: { asks: 'supervisor', until: 'tomorrow' } }), /delegation/);
  assert.throws(() => validateConfig({ ...base, delegation: { asks: 'supervisor', until: '2999-01-01T00:00:00Z', scope: 'all' } }), /delegation/);
});

test('uat.maxConcurrent is the machine-wide UAT ceiling: a positive integer, default 10',async()=>{
  const {uatSettings}=await import('../../engine/config.mjs');
  const base=loadConfig();
  assert.deepEqual(uatSettings({...base,uat:undefined}),{maxConcurrent:10,source:'default'});
  assert.deepEqual(uatSettings({...base,uat:null}),{maxConcurrent:10,source:'default'});
  assert.deepEqual(uatSettings(validateConfig({...base,uat:{maxConcurrent:3}})),{maxConcurrent:3,source:'uat'});
  for(const uat of [{maxConcurrent:0},{maxConcurrent:2.5},{maxConcurrent:'10'},{slots:4},[]])assert.throws(()=>validateConfig({...base,uat}),/uat/);
});

test('supervisor.frozenMinutes is accepted, malformed shapes are refused, and the retired quota key is unknown',()=>{
  const ok={...expected(),supervisor:{pollIntervalMs:null,repos:[],frozenMinutes:10,landGate:{mode:'exclusive'}}};
  assert.doesNotThrow(()=>validateConfig(ok));
  assert.throws(()=>validateConfig({...ok,quota:{}}),/expected language/);
  assert.throws(()=>validateConfig({...ok,supervisor:{...ok.supervisor,frozenMinutes:0}}),/frozenMinutes/);
});

test('supervisor.landGate takes only a mode: the removed push key is refused by name, with where the push lives now',()=>{
  const ok={...expected(),supervisor:{pollIntervalMs:null,repos:[],landGate:{mode:'shared'}}};
  assert.doesNotThrow(()=>validateConfig(ok));
  assert.throws(()=>validateConfig({...ok,supervisor:{...ok.supervisor,landGate:{mode:'shared',push:true}}}),/supervisor.landGate.push is removed [(]a land fast-forwards local main only .*starci release cut[)]/);
  assert.throws(()=>validateConfig({...ok,supervisor:{...ok.supervisor,landGate:{mode:'shared',other:true}}}),/supervisor.landGate must be [{]mode[?]: shared[|]exclusive[}]/);
});

test('a config naming a provider no runtime declares is refused by the provider whitelist',()=>{
  const ok=expected();
  assert.throws(()=>validateConfig({...ok,kernel:{agent:'no-such-provider'}}),/Invalid config\.yaml/);
  assert.throws(()=>validateConfig({...ok,supervisor:{...ok.supervisor,kernel:{agent:'no-such-provider'}}}),/supervisor\.kernel\.agent no-such-provider is not declared by a runtime/);
});

test('root specs is a map of family switches {harness, unit, e2e}, each at its default (harness off, unit on, e2e off)',async()=>{
  const {specsSettings,harnessSpecsEnabled}=await import('../../engine/config.mjs');
  const ok=expected();
  assert.doesNotThrow(()=>validateConfig({...ok,specs:{harness:false,unit:false,e2e:false}}));
  assert.doesNotThrow(()=>validateConfig({...ok,specs:null}));
  for(const specs of [false,'no',{harness:'no'},{lint:false}])assert.throws(()=>validateConfig({...ok,specs}),/specs must be/);
  assert.deepEqual(specsSettings({}),{harness:false,unit:true,e2e:false});
  assert.deepEqual(specsSettings({specs:{unit:false,e2e:true}}),{harness:false,unit:false,e2e:true});
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-specs-cfg-'));
  try{
    assert.equal(harnessSpecsEnabled(dir),false,'no owner file: touching-only');
    fs.writeFileSync(path.join(dir,'config.yaml'),'specs:\n  harness: true\n');
    assert.equal(harnessSpecsEnabled(dir),true);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('one default per setting: every absent-block default the code carries equals the value the shipped example states',async()=>{
  const {UAT_DEFAULTS,ASKS_DEFAULTS,CONNECTOR_DEFAULTS}=await import('../../engine/config.mjs');
  const example=parseYaml(fs.readFileSync(new URL('../../config.example.yaml',import.meta.url),'utf8'));
  assert.equal(UAT_DEFAULTS.maxConcurrent,example.uat.maxConcurrent,'the absent-block UAT ceiling is the value the example ships');
  assert.equal(ASKS_DEFAULTS.autoAcceptRecommended,example.asks.autoAcceptRecommended);
  assert.deepEqual([...ASKS_DEFAULTS.excludes].sort(),[...example.asks.excludes].sort());
  assert.deepEqual(example.models,{},'the example holds no tier: the defaults live once, in modules/models/tiers.yaml');
  const shipped=shippedTiers();
  assert.deepEqual(effectiveTiers(example,runtimeProfile()).balance,shipped.balance,'an absent models block is the shipped balance');
  for(const key of ['repos','gateway','cloudflare','telegram'])
    assert.deepEqual(example.connectors[key],CONNECTOR_DEFAULTS[key],`connectors.${key} ships the code default`);
  assert.equal(Object.hasOwn(CONNECTOR_DEFAULTS,'secretsFile'),false);
  assert.equal(Object.hasOwn(example.connectors,'secretsFile'),false);
});

test('readDotenv reads an absent file as {} and throws any other read error',async()=>{
  const {readDotenv}=await import('../../engine/config.mjs');
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-dotenv-'));
  try{
    assert.deepEqual(readDotenv(path.join(root,'missing.env')),{});
    assert.throws(()=>readDotenv(root),error=>error.message==='credential file must be a regular file','a directory is not an absent file');
    fs.writeFileSync(path.join(root,'a.env'),'A=1\n');
    assert.deepEqual(readDotenv(path.join(root,'a.env')),{A:'1'});
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('budgets accepts only the declared maxOps concurrency ceiling',()=>{
  for(const budgets of [{},{maxOps:null},{maxOps:1}])assert.doesNotThrow(()=>validateConfig({...expected(),budgets}));
  for(const budgets of [{perOpMs:1},{dailyTokens:1},{maxOps:1,perOpMs:null},{maxOps:1,dailyTokens:null}])
    assert.throws(()=>validateConfig({...expected(),budgets}),/budgets must be \{maxOps\?\}/);
});

test('current owner root declarations accept ordinary r/n/0 paths and refuse actual control characters',()=>{
  const approval={approvedBy:'owner',approvalRef:'private current-owner root validation fixture'};
  const accepted=[slashPath('D','Repositories','runner0'),winPath('D','Repositories','runner0'),'/tmp/runner0'];
  for(const root of accepted){
    assert.doesNotThrow(()=>validateConfig({...expected(),launchTrust:{...approval,profile:'automatic',roots:[root]}}),`launchTrust must accept ordinary root ${root}`);
    assert.doesNotThrow(()=>validateConfig({...expected(),retention:{workflowPurge:{...approval,repos:[root]}}}),`workflowPurge must accept ordinary root ${root}`);
  }
  for(const [name,control] of [['CR','\r'],['LF','\n'],['NUL','\0']]){
    const root=`${slashPath('D','Repositories')}/run${control}ner0`;
    assert.throws(()=>validateConfig({...expected(),launchTrust:{...approval,profile:'automatic',roots:[root]}}),/exact absolute repository roots/,`launchTrust must refuse actual ${name}`);
    assert.throws(()=>validateConfig({...expected(),retention:{workflowPurge:{...approval,repos:[root]}}}),/exact absolute repository roots/,`workflowPurge must refuse actual ${name}`);
  }
});

test('sonar.organization is configuration: a SonarCloud organization key, validated, empty in the shipped example',()=>{
  assert.equal(parseYaml(fs.readFileSync(new URL('../../config.example.yaml',import.meta.url),'utf8')).sonar.organization,null);
  assert.doesNotThrow(()=>validateConfig({...expected(),sonar:{organization:'my-org_1'}}));
  assert.doesNotThrow(()=>validateConfig({...expected(),sonar:{organization:null}}));
  assert.doesNotThrow(()=>validateConfig({...expected(),sonar:null}));
  assert.throws(()=>validateConfig({...expected(),sonar:{organization:'My Org'}}),/sonar.organization must be a SonarCloud organization key/);
  assert.throws(()=>validateConfig({...expected(),sonar:{organization:7}}),/sonar.organization must be a SonarCloud organization key/);
  assert.throws(()=>validateConfig({...expected(),sonar:{token:'x'}}),/sonar has unknown key token/);
  assert.throws(()=>validateConfig({...expected(),sonar:'org'}),/sonar must be {organization?/);
});

test('the spec preload confines the owner config.yaml to the spec temp root: a file outside it is never read, one inside it is',()=>{
  const within=process.env[OWNER_CONFIG_WITHIN_ENV];
  assert.ok(within&&path.resolve(os.tmpdir()).toLowerCase()===path.resolve(within).toLowerCase(),'tests/setup/isolated-temp.mjs sets the confinement to the spec temp root');
  const outside=fs.mkdtempSync(path.join(path.dirname(within),'starci-config-outside-'));
  const inside=fs.mkdtempSync(path.join(os.tmpdir(),'starci-config-inside-'));
  try{
    for(const dir of [outside,inside]){fs.copyFileSync(new URL('../../config.example.yaml',import.meta.url),path.join(dir,'config.example.yaml'));fs.writeFileSync(path.join(dir,'config.yaml'),stringifyYaml({...expected(),language:'xx-owner'}));}
    assert.equal(loadConfig(outside).language,expected().language,'an owner file outside the confinement reads as the shipped example');
    assert.equal(inspectOwnerConfig(outside).config,null);
    assert.equal(loadConfig(inside).language,'xx-owner','a fixture owner file under the temp root is read');
  }finally{fs.rmSync(outside,{recursive:true,force:true});fs.rmSync(inside,{recursive:true,force:true});}
});
