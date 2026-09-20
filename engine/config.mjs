import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {skillRoot} from './runtime-root.mjs';
import {parseYaml} from './yaml.mjs';

export const configRoot=skillRoot;
export const NON_OPERATION_ROLES={planner:'plan',kernelManager:'decide',validator:'verify'};
export const DEFAULT_MODEL_POOLS={'fable-astra':['claude-fable','codex-agent'],'opus-sol':['claude-agent','codex-agent']};
export const DEFAULT_NON_OPERATION_MODELS={planner:'fable-astra',kernelManager:'opus-sol',validator:'fable-astra'};
export const ADAPTIVE_ALLOCATION_MODE='adaptive';
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const defaults=()=>({pools:structuredClone(DEFAULT_MODEL_POOLS),nonOperation:{...DEFAULT_NON_OPERATION_MODELS},selection:'quota-aware'});
function runtimeProfile(){const source=fileURLToPath(new URL('../modules/models/runtimes.yaml',import.meta.url));if(!fs.existsSync(source))throw Error('Missing modules/models/runtimes.yaml');return parseYaml(fs.readFileSync(source,'utf8'));}
function targetAliases(){const source=fileURLToPath(new URL('../modules/models/registry.yaml',import.meta.url));try{const registry=fs.existsSync(source)?parseYaml(fs.readFileSync(source,'utf8')):null;return registry?.targetAliases??{};}catch{return {};}}
// A legacy config names the retired per-model pools; each id resolves to the provider-window pool that carries
// it now, so `critique.runtimes: [claude-opus, gpt-5.6-sol]` still identifies the opus-sol pair.
const canonical=id=>targetAliases()[id]??id;
const poolFor=(values,pools)=>Object.entries(pools).find(([,members])=>Array.isArray(values)&&values.length===members.length&&values.every(id=>members.includes(canonical(id))))?.[0]??null;
function migrateLegacy(config){
  const current=config?.models,keys=plain(current?.nonOperation)?Object.keys(current.nonOperation):[],sixRoles=['goalAssessment','operationPlanner','kernelManager','technicalDecision','goalCritic','validator'];
  if(plain(current?.pools)&&plain(current?.nonOperation)&&keys.every(key=>Object.hasOwn(NON_OPERATION_ROLES,key)))return config;
  if(plain(current?.pools)&&plain(current?.nonOperation)&&keys.some(key=>!sixRoles.includes(key)))return config;
  const models=defaults();
  if(plain(current?.nonOperation)){
    const old=current.nonOperation,groups={planner:['goalAssessment','operationPlanner'],kernelManager:['kernelManager','technicalDecision'],validator:['goalCritic','validator']};
    for(const [role,keys] of Object.entries(groups)){const named=keys.filter(key=>old[key]!==undefined).map(key=>Array.isArray(old[key])?poolFor(old[key],models.pools):old[key]);if(named.some(pool=>!pool)||new Set(named).size>1)throw Error(`Invalid legacy config.json: ${keys.join('/')} cannot be merged into models.nonOperation.${role}.`);if(named.length)models.nonOperation[role]=named[0];}
    return {...config,models};
  }
  const legacy=[['supervisor','kernelManager'],['validator','validator'],['critique','validator']],assigned=new Map();
  for(const [old,role] of legacy){const section=config?.[old],values=Array.isArray(section?.runtimes)?section.runtimes:typeof section==='string'?[section]:null;if(!values?.length)continue;const pool=poolFor(values,models.pools);if(!pool)throw Error(`Invalid legacy config.json: ${old}.runtimes does not match a supported model pool.`);if(assigned.has(role)&&assigned.get(role)!==pool)throw Error(`Invalid legacy config.json: ${old} conflicts with models.nonOperation.${role}.`);assigned.set(role,pool);models.nonOperation[role]=pool;}
  return {...Object.fromEntries(Object.entries(config??{}).filter(([key])=>!legacy.some(([old])=>old===key))),models};
}
export function validateConfig(config){
  const allowed=['language','model','effort','models','debug','providers','allocation','kernel','budgets'],models=config?.models,profile=runtimeProfile(),runtimes=profile?.runtimes??{};
  const knownProviders=new Set(Object.values(runtimes).map(runtime=>runtime?.provider).filter(Boolean));
  if(config?.debug!==undefined&&typeof config.debug!=='boolean')throw Error('Invalid config.json: debug must be true or false.');
  if(config?.providers!==undefined){
    const named=config.providers;
    if(!Array.isArray(named)||named.some(provider=>typeof provider!=='string'||!provider.trim())||new Set(named).size!==named.length)
      throw Error('Invalid config.json: providers must be a list of unique provider names.');
    const unknown=named.filter(provider=>!knownProviders.has(provider));
    if(unknown.length)throw Error(`Invalid config.json: providers names ${unknown.join(', ')}, which no runtime declares (known: ${[...knownProviders].sort().join(', ')}).`);
  }
  if(config?.allocation!==undefined){
    const allocation=config.allocation,preferred=allocation?.preferredProvider;
    if(!plain(allocation)||Object.keys(allocation).some(key=>!['mode','preferredProvider'].includes(key))||allocation.mode!==ADAPTIVE_ALLOCATION_MODE||!(preferred===null||preferred===undefined||typeof preferred==='string'&&preferred.trim()))
      throw Error('Invalid config.json: allocation must be {mode:"adaptive", preferredProvider?: <provider|null>}.');
    if(typeof preferred==='string'&&!knownProviders.has(preferred))throw Error(`Invalid config.json: allocation.preferredProvider ${preferred} is not declared by a runtime (known: ${[...knownProviders].sort().join(', ')}).`);
    if(config.providers!==undefined)throw Error('Invalid config.json: use allocation or the legacy providers list, not both.');
  }
  if(config?.kernel!==undefined){
    const kernel=config.kernel;
    if(!plain(kernel)||Object.keys(kernel).some(key=>!['provider','model','effort'].includes(key))||Object.values(kernel).some(value=>value!==null&&(typeof value!=='string'||!value.trim())))
      throw Error('Invalid config.yaml: kernel must be {provider?, model?, effort?} with string-or-null values.');
    if(typeof kernel.effort==='string'&&!['none','minimal','low','medium','high','xhigh','max','ultra'].includes(kernel.effort))
      throw Error('Invalid config.yaml: kernel.effort must use the effort vocabulary.');
  }
  if(config?.budgets!==undefined){
    const budgets=config.budgets;
    if(!plain(budgets)||Object.keys(budgets).some(key=>!['maxOps','perOpMs','dailyTokens'].includes(key))||Object.values(budgets).some(value=>value!==null&&!(Number.isInteger(value)&&value>0)))
      throw Error('Invalid config.yaml: budgets must be {maxOps?, perOpMs?, dailyTokens?} with positive-integer-or-null values.');
  }
  if(!plain(config)||Object.keys(config).some(key=>!allowed.includes(key))||typeof config.language!=='string'||!/^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/.test(config.language)||!(config.model===null||typeof config.model==='string'&&config.model.trim())||!['none','minimal','low','medium','high','xhigh','max','ultra'].includes(config.effort)||!plain(models)||Object.keys(models).some(key=>!['pools','nonOperation','selection'].includes(key))||models.selection!=='quota-aware'||!plain(models.pools)||!plain(models.nonOperation)||Object.keys(models.pools).length!==2||Object.keys(models.pools).some(key=>!Object.hasOwn(DEFAULT_MODEL_POOLS,key))||Object.keys(models.nonOperation).length!==3||Object.keys(models.nonOperation).some(key=>!Object.hasOwn(NON_OPERATION_ROLES,key)))throw Error('Invalid config.json: expected language, model, effort and the closed quota-aware model pools/non-operation role map.');
  for(const [pool,members] of Object.entries(models.pools))if(!Array.isArray(members)||members.length!==2||new Set(members).size!==2||members.some(id=>typeof id!=='string'||!plain(runtimes[id]))||poolFor(members,DEFAULT_MODEL_POOLS)!==pool)throw Error(`Invalid config.json: models.pools.${pool} must contain its canonical pair of two unique known runtime ids.`);
  for(const [role,required] of Object.entries(NON_OPERATION_ROLES)){const pool=models.nonOperation[role],members=models.pools[pool];if(typeof pool!=='string'||!members||members.some(id=>!runtimes[id].roles?.includes(required)))throw Error(`Invalid config.json: models.nonOperation.${role} must name a pool whose members carry the ${required} role.`);}
  return config;
}
export function effectiveNonOperationModels(config=loadConfig()){const models=validateConfig(config).models;return Object.fromEntries(Object.keys(NON_OPERATION_ROLES).map(role=>[role,{pool:models.nonOperation[role],runtimes:[...models.pools[models.nonOperation[role]]],selection:models.selection}]));}
/**
 * The owner allocation control. `allocation` is the current shape. The former ordered `providers` list is read
 * compatibly as adaptive mode with its first member as the preferred family; the rest are not a fallback chain.
 * This is an in-memory interpretation only: existing ignored config.json files are never rewritten.
 */
export function configuredAllocationPolicy(config=loadConfig()){
  validateConfig(config);
  if(plain(config.allocation))return {mode:ADAPTIVE_ALLOCATION_MODE,preferredProvider:config.allocation.preferredProvider??null,source:'allocation'};
  const legacy=Array.isArray(config.providers)?config.providers.filter(provider=>typeof provider==='string'&&provider.trim()):[];
  return legacy.length?{mode:ADAPTIVE_ALLOCATION_MODE,preferredProvider:legacy[0],source:'legacy-providers'}:
    {mode:ADAPTIVE_ALLOCATION_MODE,preferredProvider:null,source:'default'};
}
/** @deprecated Compatibility accessor; only the first entry is an owner preference, never a try chain. */
export const configuredProviderOrder=(config=loadConfig())=>{const policy=configuredAllocationPolicy(config);return policy?.preferredProvider?[policy.preferredProvider]:[];};
export const nonOperationModels=(role,config=loadConfig())=>{if(!Object.hasOwn(NON_OPERATION_ROLES,role))throw Error(`Unknown non-operation model role ${role}`);return effectiveNonOperationModels(config)[role].runtimes;};
function readExample(root=configRoot){const yaml=path.join(root,'config.example.yaml');if(fs.existsSync(yaml))return validateConfig(migrateLegacy(parseYaml(fs.readFileSync(yaml,'utf8'))));const json=path.join(root,'config.example.json');if(fs.existsSync(json))return validateConfig(migrateLegacy(JSON.parse(fs.readFileSync(json,'utf8'))));throw Error('Missing config.example.yaml (or legacy config.example.json)');}
/**
 * The owner config reader: `config.yaml` is the per-project file (gitignored,
 * seeded verbatim from `config.example.yaml` by the installer — comments and
 * all). A legacy `config.json` is still honored so existing installs keep
 * working. Absent both → the example's defaults. Returns the validated config
 * or null when no owner file exists.
 */
export function readOwnerConfig(root=configRoot){
  const yaml=path.join(root,'config.yaml');
  if(fs.existsSync(yaml))return validateConfig(migrateLegacy(parseYaml(fs.readFileSync(yaml,'utf8'))));
  const json=path.join(root,'config.json');
  if(fs.existsSync(json))return validateConfig(migrateLegacy(JSON.parse(fs.readFileSync(json,'utf8'))));
  return null;
}
export const loadOwnerConfig=readOwnerConfig;
export function loadConfig(root=configRoot,{initialize=false}={}){
  const yaml=path.join(root,'config.yaml');
  if(initialize&&!fs.existsSync(yaml)){
    const exampleFile=path.join(root,'config.example.yaml');
    if(fs.existsSync(exampleFile)){try{fs.copyFileSync(exampleFile,yaml);}catch{/* best effort */}}
  }
  return readOwnerConfig(root)??readExample(root);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{process.stdout.write(JSON.stringify(loadConfig(configRoot,{initialize:true}))+'\n');}catch(error){process.stderr.write(error.message+'\n');process.exitCode=1;}}
