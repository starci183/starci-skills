import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {configuredAllocationPolicy,DEFAULT_MODEL_POOLS,defaultParallelGear,effectiveNonOperationModels,loadConfig,nonOperationModels,parallelGear,slicingGears,validateConfig} from '../engine/config.mjs';
import {parseYaml,stringifyYaml} from '../engine/yaml.mjs';
// config.example.yaml is the shipped default — the installer seeds config.yaml from it verbatim, so it
// is what loadConfig({initialize:true}) must produce. The spec reads it rather than keeping a copy.
const EXAMPLE_NON_OPERATION={...parseYaml(fs.readFileSync(new URL('../config.example.yaml',import.meta.url),'utf8')).models.nonOperation};
const expected=()=>({language:'vi',model:null,effort:'medium',kernel:{group:[{agent:'claude',model:'claude-opus-5-5'},{agent:'codex',model:'gpt-6-sol'}],effort:'high'},parallel:{gear:1},supervisor:{pollIntervalMs:null},delegation:null,budgets:{maxOps:null,perOpMs:null,dailyTokens:null},allocation:{mode:'adaptive',preferredProvider:null},models:{selection:'quota-aware',pools:structuredClone(DEFAULT_MODEL_POOLS),nonOperation:{...EXAMPLE_NON_OPERATION}}});
test('local config initializes the three canonical quota-aware non-operation roles and rejects unknown roles, models and shapes',()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-config-'));try{fs.copyFileSync(new URL('../config.example.yaml',import.meta.url),path.join(root,'config.example.yaml'));assert.deepEqual(loadConfig(root,{initialize:true}),expected());assert.deepEqual(effectiveNonOperationModels(loadConfig(root)).kernelManager,{pool:'sol-opus',runtimes:['claude-agent','codex-agent'],selection:'quota-aware'});const badRole=expected();badRole.models.nonOperation.rescuer='sol-opus';assert.throws(()=>validateConfig(badRole),/closed quota-aware/);fs.writeFileSync(path.join(root,'config.yaml'),stringifyYaml(badRole));assert.throws(()=>loadConfig(root),/closed quota-aware/,'loadConfig must not reinterpret an unknown non-operation role');const badModel=expected();badModel.models.pools['sol-opus']=['unknown-model','codex-agent'];assert.throws(()=>validateConfig(badModel),/sol-opus/);const reordered=expected();reordered.models.pools['sol-opus']=['codex-agent','claude-agent'];assert.deepEqual(effectiveNonOperationModels(reordered).validator.runtimes,['codex-agent','claude-agent'],'member order is the owner route order');const duplicate=expected();duplicate.models.pools['sol-opus']=['claude-agent','claude-agent'];assert.throws(()=>validateConfig(duplicate),/canonical pair/);assert.throws(()=>nonOperationModels('ownerAuthority',expected()),/Unknown non-operation/);const custom={...expected(),language:'en',model:'test-host-model'};fs.writeFileSync(path.join(root,'config.yaml'),stringifyYaml(custom));assert.deepEqual(loadConfig(root),custom);fs.writeFileSync(path.join(root,'config.yaml'),'null\n');assert.throws(()=>loadConfig(root),/Invalid config/);}finally{fs.rmSync(root,{recursive:true,force:true});}});
test('top-level supervisor/validator/critique sections are refused as unknown keys',()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-config-old-'));try{const old=expected();old.supervisor={runtimes:['codex-agent','claude-agent']};old.critique={runtimes:['claude-agent','codex-agent']};fs.writeFileSync(path.join(root,'config.yaml'),stringifyYaml(old));assert.throws(()=>loadConfig(root),/Invalid config/);}finally{fs.rmSync(root,{recursive:true,force:true});}});
test('six-role nonOperation drafts are refused by the closed schema',()=>{const draft=expected();draft.models.nonOperation={goalAssessment:['claude-agent','codex-agent'],operationPlanner:['claude-agent','codex-agent'],kernelManager:['claude-agent','codex-agent'],technicalDecision:['claude-agent','codex-agent'],goalCritic:['claude-agent','codex-agent'],validator:['claude-agent','codex-agent']};assert.throws(()=>validateConfig(draft),/Invalid config/);});
test('a lone config.json is not honored — config.yaml is the only owner file',()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-config-json-'));try{fs.writeFileSync(path.join(root,'config.json'),JSON.stringify({language:'vi',model:null,effort:'medium',models:{selection:'quota-aware',pools:structuredClone(DEFAULT_MODEL_POOLS),nonOperation:{...EXAMPLE_NON_OPERATION}}}));assert.throws(()=>loadConfig(root),/Missing config\.example\.yaml/,'config.json must not be read; with no example file the loader fails closed');}finally{fs.rmSync(root,{recursive:true,force:true});}});
test('relocated installed config reads the source model registry',async()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-config-installed-'));try{for(const file of ['engine/config.mjs','engine/runtime-root.mjs','engine/yaml.mjs','config.example.yaml','modules/models/runtimes.yaml']){const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(new URL(`../${file}`,import.meta.url),target);}const installed=await import(`${new URL(`file:///${path.join(root,'engine/config.mjs').replaceAll('\\','/')}`)}?fixture=${Date.now()}`);assert.deepEqual(installed.nonOperationModels('kernelManager',installed.loadConfig(root)),['claude-agent','codex-agent']);assert.equal(fs.existsSync(path.join(root,'model','runtimes.yaml')),false);}finally{fs.rmSync(root,{recursive:true,force:true});}});

// parallel.gear is the owner's ONE parallelism knob: an integer from
// modules/models/runtimes.yaml allocation.slicing.gears, defaulting to the first
// declared gear when the block is absent, failing closed on anything else.
test('parallel.gear accepts a declared gear, defaults to the first one and fails closed on the rest',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-config-gear-'));
  try{
    fs.copyFileSync(new URL('../config.example.yaml',import.meta.url),path.join(root,'config.example.yaml'));
    const gears=slicingGears();
    assert.deepEqual(gears,[1,2],'the declared gear vocabulary is data in runtimes.yaml');
    assert.equal(defaultParallelGear(),1);
    const base=loadConfig(root,{initialize:true});
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

test('adaptive capacity is the default and the owner may prefer one declared provider without creating a chain',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-config-providers-'));
  try{
    fs.copyFileSync(new URL('../config.example.yaml',import.meta.url),path.join(root,'config.example.yaml'));
    const base=loadConfig(root,{initialize:true});
    assert.deepEqual(configuredAllocationPolicy(base),{mode:'adaptive',preferredProvider:null,source:'allocation'});
    const explicit={...base,allocation:{mode:'adaptive',preferredProvider:'codex'}};
    fs.writeFileSync(path.join(root,'config.yaml'),stringifyYaml(explicit));
    assert.deepEqual(configuredAllocationPolicy(loadConfig(root)),{mode:'adaptive',preferredProvider:'codex',source:'allocation'});
    assert.throws(()=>validateConfig({...base,allocation:{mode:'adaptive',preferredProvider:'openai'}}),/not declared/);
    assert.throws(()=>validateConfig({...base,allocation:{mode:'chain',preferredProvider:'codex'}}),/mode:"adaptive"/);
    assert.throws(()=>validateConfig({...base,providers:['codex']}),/Invalid config/,'a providers list is an unknown key, not an allocation source');
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('supervisor.pollIntervalMs is an owner key: an integer of at least a minute, or null', async () => {
  const { validateConfig } = await import('../engine/config.mjs');
  const { parseYaml } = await import('../engine/yaml.mjs');
  const fs = await import('node:fs');
  const base = parseYaml(fs.readFileSync(new URL('../config.example.yaml', import.meta.url), 'utf8'));
  assert.doesNotThrow(() => validateConfig({ ...base, supervisor: { pollIntervalMs: 600000 } }));
  assert.doesNotThrow(() => validateConfig({ ...base, supervisor: { pollIntervalMs: null } }));
  assert.throws(() => validateConfig({ ...base, supervisor: { pollIntervalMs: 5000 } }), /supervisor/);
  assert.throws(() => validateConfig({ ...base, supervisor: { cadence: 600000 } }), /supervisor/);
});

test('the shipped example validates on the current catalog and a config naming a removed pool is refused',()=>{
  const example=parseYaml(fs.readFileSync(new URL('../config.example.yaml',import.meta.url),'utf8'));
  assert.equal(validateConfig(example),example);
  assert.deepEqual(example.kernel,{group:[{agent:'claude',model:'claude-opus-5-5'},{agent:'codex',model:'gpt-6-sol'}],effort:'high'},'the shipped kernel is the Claude-then-Sol group');
  assert.deepEqual(Object.keys(example.models.pools),['sol-opus']);
  const removed=expected();
  removed.models.pools={'fable-astra':['claude-fable','codex-agent']};
  removed.models.nonOperation={planner:'fable-astra',kernelManager:'fable-astra',validator:'fable-astra'};
  assert.throws(()=>validateConfig(removed),/closed quota-aware/,'fable-astra is not a declared pool');
  const alongside=expected();
  alongside.models.pools['fable-astra']=['claude-fable','codex-agent'];
  assert.throws(()=>validateConfig(alongside),/closed quota-aware/,'a removed pool beside sol-opus is still refused');
  const dangling=expected();
  dangling.models.nonOperation.planner='fable-astra';
  assert.throws(()=>validateConfig(dangling),/models\.nonOperation\.planner/,'a role naming a removed pool is refused');
});

test('kernel takes a single authoritative pin or an ordered group, never a mix',()=>{
  const base=expected();
  const withKernel=kernel=>({...base,kernel});
  for(const pin of [{agent:'codex',model:'gpt-6-sol',effort:'high'},{model:'claude-opus-5-5'},{agent:'claude'},{agent:null,model:null,effort:null}])
    assert.doesNotThrow(()=>validateConfig(withKernel(pin)),JSON.stringify(pin));
  for(const group of [
    {group:[{agent:'claude',model:'claude-opus-5-5'},{agent:'codex',model:'gpt-6-sol'}],effort:'high'},
    {group:[{agent:'codex',model:'gpt-6-sol'},{agent:'claude'}]},
    {group:[{agent:'claude',model:'claude-opus-5-5'}],effort:null},
  ])assert.doesNotThrow(()=>validateConfig(withKernel(group)),JSON.stringify(group));
  const refused=[
    [{group:[]},/at least one member/],
    [{group:[{agent:'claude'}],agent:'codex'},/kernel group must be/],
    [{group:[{agent:'claude',model:'claude-opus-5-5',effort:'high'}]},/kernel group must be/],
    [{group:[{agent:'claude'},{agent:'claude'}]},/each agent once/],
    [{group:[{agent:'gemini'}]},/kernel\.group agent gemini/],
    [{group:[{agent:'claude',model:'gpt-6-sol'}]},/model gpt-6-sol is not declared by a claude runtime/],
    [{group:[{agent:'codex',model:'gpt-6-sol'}],effort:'warp'},/effort vocabulary/],
    [{agent:'codex',pool:'think'},/kernel must be/],
  ];
  for(const [kernel,pattern] of refused)assert.throws(()=>validateConfig(withKernel(kernel)),pattern,JSON.stringify(kernel));
});

test('delegation is an owner key: a named delegate answers asks until a time, and expires', async () => {
  const { validateConfig, activeDelegation } = await import('../engine/config.mjs');
  const { parseYaml } = await import('../engine/yaml.mjs');
  const fs = await import('node:fs');
  const base = parseYaml(fs.readFileSync(new URL('../config.example.yaml', import.meta.url), 'utf8'));
  assert.equal(base.delegation, null, 'the example ships with no delegation');
  const live = { ...base, delegation: { asks: 'supervisor', until: '2999-01-01T00:00:00Z', excludes: ['credentials'] } };
  assert.doesNotThrow(() => validateConfig(live));
  assert.deepEqual(activeDelegation(live), { asks: 'supervisor', until: '2999-01-01T00:00:00Z', excludes: ['credentials'], note: null });
  assert.equal(activeDelegation({ ...base, delegation: { asks: 'supervisor', until: '2000-01-01T00:00:00Z' } }), null, 'an expired delegation is not active');
  assert.throws(() => validateConfig({ ...base, delegation: { asks: 'supervisor', until: 'tomorrow' } }), /delegation/);
  assert.throws(() => validateConfig({ ...base, delegation: { asks: 'supervisor', until: '2999-01-01T00:00:00Z', scope: 'all' } }), /delegation/);
});
