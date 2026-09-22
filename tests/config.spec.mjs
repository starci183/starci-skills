import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {configuredAllocationPolicy,DEFAULT_MODEL_POOLS,effectiveNonOperationModels,loadConfig,nonOperationModels,validateConfig} from '../engine/config.mjs';
import {parseYaml,stringifyYaml} from '../engine/yaml.mjs';
// config.example.yaml is the shipped default — the installer seeds config.yaml from it verbatim, so it
// is what loadConfig({initialize:true}) must produce. The spec reads it rather than keeping a copy.
const EXAMPLE_NON_OPERATION={...parseYaml(fs.readFileSync(new URL('../config.example.yaml',import.meta.url),'utf8')).models.nonOperation};
const expected=()=>({language:'vi',model:null,effort:'medium',kernel:{agent:'codex',model:'gpt-6-sol',effort:'high'},budgets:{maxOps:null,perOpMs:null,dailyTokens:null},allocation:{mode:'adaptive',preferredProvider:null},models:{selection:'quota-aware',pools:structuredClone(DEFAULT_MODEL_POOLS),nonOperation:{...EXAMPLE_NON_OPERATION}}});
test('local config initializes the three canonical quota-aware non-operation roles and rejects unknown roles, models and shapes',()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-config-'));try{fs.copyFileSync(new URL('../config.example.yaml',import.meta.url),path.join(root,'config.example.yaml'));assert.deepEqual(loadConfig(root,{initialize:true}),expected());assert.deepEqual(effectiveNonOperationModels(loadConfig(root)).kernelManager,{pool:'sol-opus',runtimes:['codex-agent','claude-agent'],selection:'quota-aware'});const badRole=expected();badRole.models.nonOperation.rescuer='sol-opus';assert.throws(()=>validateConfig(badRole),/closed quota-aware/);fs.writeFileSync(path.join(root,'config.yaml'),stringifyYaml(badRole));assert.throws(()=>loadConfig(root),/closed quota-aware/,'loadConfig must not reinterpret an unknown non-operation role');const badModel=expected();badModel.models.pools['sol-opus']=['unknown-model','codex-agent'];assert.throws(()=>validateConfig(badModel),/sol-opus/);const reordered=expected();reordered.models.pools['sol-opus']=['claude-agent','codex-agent'];assert.deepEqual(effectiveNonOperationModels(reordered).validator.runtimes,['claude-agent','codex-agent'],'member order is the owner route order');const duplicate=expected();duplicate.models.pools['sol-opus']=['claude-agent','claude-agent'];assert.throws(()=>validateConfig(duplicate),/canonical pair/);assert.throws(()=>nonOperationModels('ownerAuthority',expected()),/Unknown non-operation/);const custom={...expected(),language:'en',model:'test-host-model'};fs.writeFileSync(path.join(root,'config.yaml'),stringifyYaml(custom));assert.deepEqual(loadConfig(root),custom);fs.writeFileSync(path.join(root,'config.yaml'),'null\n');assert.throws(()=>loadConfig(root),/Invalid config/);}finally{fs.rmSync(root,{recursive:true,force:true});}});
test('top-level supervisor/validator/critique sections are refused as unknown keys',()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-config-old-'));try{const old=expected();old.supervisor={runtimes:['codex-agent','claude-agent']};old.critique={runtimes:['claude-agent','codex-agent']};fs.writeFileSync(path.join(root,'config.yaml'),stringifyYaml(old));assert.throws(()=>loadConfig(root),/Invalid config/);}finally{fs.rmSync(root,{recursive:true,force:true});}});
test('six-role nonOperation drafts are refused by the closed schema',()=>{const draft=expected();draft.models.nonOperation={goalAssessment:['claude-agent','codex-agent'],operationPlanner:['claude-agent','codex-agent'],kernelManager:['claude-agent','codex-agent'],technicalDecision:['claude-agent','codex-agent'],goalCritic:['claude-agent','codex-agent'],validator:['claude-agent','codex-agent']};assert.throws(()=>validateConfig(draft),/Invalid config/);});
test('a lone config.json is not honored — config.yaml is the only owner file',()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-config-json-'));try{fs.writeFileSync(path.join(root,'config.json'),JSON.stringify({language:'vi',model:null,effort:'medium',models:{selection:'quota-aware',pools:structuredClone(DEFAULT_MODEL_POOLS),nonOperation:{...EXAMPLE_NON_OPERATION}}}));assert.throws(()=>loadConfig(root),/Missing config\.example\.yaml/,'config.json must not be read; with no example file the loader fails closed');}finally{fs.rmSync(root,{recursive:true,force:true});}});
test('relocated installed config reads the source model registry',async()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-config-installed-'));try{for(const file of ['engine/config.mjs','engine/runtime-root.mjs','engine/yaml.mjs','config.example.yaml','modules/models/runtimes.yaml']){const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(new URL(`../${file}`,import.meta.url),target);}const installed=await import(`${new URL(`file:///${path.join(root,'engine/config.mjs').replaceAll('\\','/')}`)}?fixture=${Date.now()}`);assert.deepEqual(installed.nonOperationModels('kernelManager',installed.loadConfig(root)),['codex-agent','claude-agent']);assert.equal(fs.existsSync(path.join(root,'model','runtimes.yaml')),false);}finally{fs.rmSync(root,{recursive:true,force:true});}});

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

test('the shipped example validates on the current catalog and a config naming a removed pool is refused',()=>{
  const example=parseYaml(fs.readFileSync(new URL('../config.example.yaml',import.meta.url),'utf8'));
  assert.equal(validateConfig(example),example);
  assert.deepEqual(example.kernel,{agent:'codex',model:'gpt-6-sol',effort:'high'});
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
