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
/** The effort vocabulary, ordered weakest to strongest — the only list of it. */
export const EFFORT_LEVELS=['none','minimal','low','medium','high','xhigh','max','ultra'];
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function runtimeProfile(){const source=fileURLToPath(new URL('../modules/models/runtimes.yaml',import.meta.url));if(!fs.existsSync(source))throw Error('Missing modules/models/runtimes.yaml');return parseYaml(fs.readFileSync(source,'utf8'));}
export function validateConfig(config){
  const allowed=['language','model','effort','models','debug','allocation','kernel','budgets'],models=config?.models,profile=runtimeProfile(),runtimes=profile?.runtimes??{};
  const knownProviders=new Set(Object.values(runtimes).map(runtime=>runtime?.provider).filter(Boolean));
  if(config?.debug!==undefined&&typeof config.debug!=='boolean')throw Error('Invalid config.yaml: debug must be true or false.');
  if(config?.allocation!==undefined){
    const allocation=config.allocation,preferred=allocation?.preferredProvider;
    if(!plain(allocation)||Object.keys(allocation).some(key=>!['mode','preferredProvider'].includes(key))||allocation.mode!==ADAPTIVE_ALLOCATION_MODE||!(preferred===null||preferred===undefined||typeof preferred==='string'&&preferred.trim()))
      throw Error('Invalid config.yaml: allocation must be {mode:"adaptive", preferredProvider?: <provider|null>}.');
    if(typeof preferred==='string'&&!knownProviders.has(preferred))throw Error(`Invalid config.yaml: allocation.preferredProvider ${preferred} is not declared by a runtime (known: ${[...knownProviders].sort().join(', ')}).`);
  }
  if(config?.kernel!==undefined){
    const kernel=config.kernel;
    if(!plain(kernel)||Object.keys(kernel).some(key=>!['agent','model','effort'].includes(key))||Object.values(kernel).some(value=>value!==null&&(typeof value!=='string'||!value.trim())))
      throw Error('Invalid config.yaml: kernel must be {agent?, model?, effort?} with string-or-null values.');
    if(typeof kernel.agent==='string'&&!knownProviders.has(kernel.agent))
      throw Error(`Invalid config.yaml: kernel.agent ${kernel.agent} is not declared by a runtime (known: ${[...knownProviders].sort().join(', ')}).`);
    if(typeof kernel.effort==='string'&&!EFFORT_LEVELS.includes(kernel.effort))
      throw Error('Invalid config.yaml: kernel.effort must use the effort vocabulary.');
  }
  if(config?.budgets!==undefined){
    const budgets=config.budgets;
    if(!plain(budgets)||Object.keys(budgets).some(key=>!['maxOps','perOpMs','dailyTokens'].includes(key))||Object.values(budgets).some(value=>value!==null&&!(Number.isInteger(value)&&value>0)))
      throw Error('Invalid config.yaml: budgets must be {maxOps?, perOpMs?, dailyTokens?} with positive-integer-or-null values.');
  }
  if(!plain(config)||Object.keys(config).some(key=>!allowed.includes(key))||typeof config.language!=='string'||!/^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/.test(config.language)||!(config.model===null||typeof config.model==='string'&&config.model.trim())||!EFFORT_LEVELS.includes(config.effort)||!plain(models)||Object.keys(models).some(key=>!['pools','nonOperation','selection'].includes(key))||models.selection!=='quota-aware'||!plain(models.pools)||!plain(models.nonOperation)||Object.keys(models.pools).length!==2||Object.keys(models.pools).some(key=>!Object.hasOwn(DEFAULT_MODEL_POOLS,key))||Object.keys(models.nonOperation).length!==3||Object.keys(models.nonOperation).some(key=>!Object.hasOwn(NON_OPERATION_ROLES,key)))throw Error('Invalid config.yaml: expected language, model, effort and the closed quota-aware model pools/non-operation role map.');
  for(const [pool,members] of Object.entries(models.pools))if(!Array.isArray(members)||members.length!==2||new Set(members).size!==2||members.some(id=>typeof id!=='string'||!plain(runtimes[id]))||!(members.length===DEFAULT_MODEL_POOLS[pool].length&&members.every(id=>DEFAULT_MODEL_POOLS[pool].includes(id))))throw Error(`Invalid config.yaml: models.pools.${pool} must contain its canonical pair of two unique known runtime ids.`);
  for(const [role,required] of Object.entries(NON_OPERATION_ROLES)){const pool=models.nonOperation[role],members=models.pools[pool];if(typeof pool!=='string'||!members||members.some(id=>!runtimes[id].roles?.includes(required)))throw Error(`Invalid config.yaml: models.nonOperation.${role} must name a pool whose members carry the ${required} role.`);}
  return config;
}
export function effectiveNonOperationModels(config=loadConfig()){const models=validateConfig(config).models;return Object.fromEntries(Object.keys(NON_OPERATION_ROLES).map(role=>[role,{pool:models.nonOperation[role],runtimes:[...models.pools[models.nonOperation[role]]],selection:models.selection}]));}
/**
 * The owner allocation control. `allocation` is the only shape; adaptive mode with an
 * optional preferredProvider bias — never a fallback chain.
 */
export function configuredAllocationPolicy(config=loadConfig()){
  validateConfig(config);
  if(plain(config.allocation))return {mode:ADAPTIVE_ALLOCATION_MODE,preferredProvider:config.allocation.preferredProvider??null,source:'allocation'};
  return {mode:ADAPTIVE_ALLOCATION_MODE,preferredProvider:null,source:'default'};
}
export const nonOperationModels=(role,config=loadConfig())=>{if(!Object.hasOwn(NON_OPERATION_ROLES,role))throw Error(`Unknown non-operation model role ${role}`);return effectiveNonOperationModels(config)[role].runtimes;};
function readExample(root=configRoot){const yaml=path.join(root,'config.example.yaml');if(fs.existsSync(yaml))return validateConfig(parseYaml(fs.readFileSync(yaml,'utf8')));throw Error('Missing config.example.yaml');}
/**
 * The owner config reader: `config.yaml` is the per-project file (gitignored,
 * seeded verbatim from `config.example.yaml` by the installer — comments and
 * all). Returns the validated owner config, or null when that file does not
 * exist; falling back to the example's defaults is `loadConfig`.
 */
export function readOwnerConfig(root=configRoot){
  const yaml=path.join(root,'config.yaml');
  if(fs.existsSync(yaml))return validateConfig(parseYaml(fs.readFileSync(yaml,'utf8')));
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
