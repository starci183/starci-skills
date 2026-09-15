import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {skillRoot,readDistJson} from '../core/runtime-root.mjs';
import {parseYaml} from '../core/yaml.mjs';

export const configRoot=skillRoot;
export const NON_OPERATION_ROLES={planner:'plan',kernelManager:'decide',validator:'verify'};
export const DEFAULT_MODEL_POOLS={'fable-astra':['claude-fable-5.1','gpt-6-astra'],'opus-sol':['claude-opus','gpt-5.6-sol']};
export const DEFAULT_NON_OPERATION_MODELS={planner:'fable-astra',kernelManager:'opus-sol',validator:'fable-astra'};
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const defaults=()=>({pools:structuredClone(DEFAULT_MODEL_POOLS),nonOperation:{...DEFAULT_NON_OPERATION_MODELS},selection:'quota-aware'});
function runtimeProfile(){const source=fileURLToPath(new URL('../model/runtimes.yaml',import.meta.url));return fs.existsSync(source)?parseYaml(fs.readFileSync(source,'utf8')):readDistJson('model','runtimes.json');}
const poolFor=(values,pools)=>Object.entries(pools).find(([,members])=>Array.isArray(values)&&values.length===members.length&&values.every(id=>members.includes(id)))?.[0]??null;
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
  const allowed=['language','model','effort','models','debug','providers'],models=config?.models,profile=runtimeProfile(),runtimes=profile?.runtimes??{};
  if(config?.debug!==undefined&&typeof config.debug!=='boolean')throw Error('Invalid config.json: debug must be true or false.');
  if(config?.providers!==undefined){
    const known=new Set(Object.values(runtimes).map(runtime=>runtime?.provider).filter(Boolean)),named=config.providers;
    if(!Array.isArray(named)||named.some(provider=>typeof provider!=='string'||!provider.trim())||new Set(named).size!==named.length)
      throw Error('Invalid config.json: providers must be a list of unique provider names.');
    const unknown=named.filter(provider=>!known.has(provider));
    if(unknown.length)throw Error(`Invalid config.json: providers names ${unknown.join(', ')}, which no runtime declares (known: ${[...known].sort().join(', ')}).`);
  }
  if(!plain(config)||Object.keys(config).some(key=>!allowed.includes(key))||typeof config.language!=='string'||!/^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/.test(config.language)||!(config.model===null||typeof config.model==='string'&&config.model.trim())||!['none','minimal','low','medium','high','xhigh','max','ultra'].includes(config.effort)||!plain(models)||Object.keys(models).some(key=>!['pools','nonOperation','selection'].includes(key))||models.selection!=='quota-aware'||!plain(models.pools)||!plain(models.nonOperation)||Object.keys(models.pools).length!==2||Object.keys(models.pools).some(key=>!Object.hasOwn(DEFAULT_MODEL_POOLS,key))||Object.keys(models.nonOperation).length!==3||Object.keys(models.nonOperation).some(key=>!Object.hasOwn(NON_OPERATION_ROLES,key)))throw Error('Invalid config.json: expected language, model, effort and the closed quota-aware model pools/non-operation role map.');
  for(const [pool,members] of Object.entries(models.pools))if(!Array.isArray(members)||members.length!==2||new Set(members).size!==2||members.some(id=>typeof id!=='string'||!plain(runtimes[id]))||poolFor(members,DEFAULT_MODEL_POOLS)!==pool)throw Error(`Invalid config.json: models.pools.${pool} must contain its canonical pair of two unique known runtime ids.`);
  for(const [role,required] of Object.entries(NON_OPERATION_ROLES)){const pool=models.nonOperation[role],members=models.pools[pool];if(typeof pool!=='string'||!members||members.some(id=>!runtimes[id].roles?.includes(required)))throw Error(`Invalid config.json: models.nonOperation.${role} must name a pool whose members carry the ${required} role.`);}
  return config;
}
export function effectiveNonOperationModels(config=loadConfig()){const models=validateConfig(config).models;return Object.fromEntries(Object.keys(NON_OPERATION_ROLES).map(role=>[role,{pool:models.nonOperation[role],runtimes:[...models.pools[models.nonOperation[role]]],selection:models.selection}]));}
/**
 * The order the owner wants their providers tried in, for this run. It reorders preference, it never filters:
 * a preferred provider that is exhausted, cooling or ineligible still overflows to the next one, so naming a
 * provider cannot stall a workflow. An absent list leaves the profile's own order untouched.
 */
export const configuredProviderOrder=(config=loadConfig())=>Array.isArray(config?.providers)?config.providers.filter(provider=>typeof provider==='string'&&provider.trim()):[];
export const nonOperationModels=(role,config=loadConfig())=>{if(!Object.hasOwn(NON_OPERATION_ROLES,role))throw Error(`Unknown non-operation model role ${role}`);return effectiveNonOperationModels(config)[role].runtimes;};
function readExample(root=configRoot){const yaml=path.join(root,'config.example.yaml');if(fs.existsSync(yaml))return validateConfig(migrateLegacy(parseYaml(fs.readFileSync(yaml,'utf8'))));const json=path.join(root,'config.example.json');if(fs.existsSync(json))return validateConfig(migrateLegacy(JSON.parse(fs.readFileSync(json,'utf8'))));const fromDist=path.join(root,'.dist','config.example.json');if(fs.existsSync(fromDist))return validateConfig(migrateLegacy(JSON.parse(fs.readFileSync(fromDist,'utf8'))));throw Error('Missing config.example.yaml (or legacy config.example.json)');}
export function loadConfig(root=configRoot,{initialize=false}={}){const file=path.join(root,'config.json');if(initialize&&!fs.existsSync(file)){const example=readExample(root);try{fs.writeFileSync(file,JSON.stringify(example,null,2)+'\n',{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}}if(fs.existsSync(file))return validateConfig(migrateLegacy(JSON.parse(fs.readFileSync(file,'utf8'))));return readExample(root);}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{process.stdout.write(JSON.stringify(loadConfig(configRoot,{initialize:true}))+'\n');}catch(error){process.stderr.write(error.message+'\n');process.exitCode=1;}}
