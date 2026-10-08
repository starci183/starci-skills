import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {parseYaml} from './yaml.mjs';
import {isPlainObject as plain} from './plain-object.mjs';
import {invalid} from './invalid-config.mjs';
import {byCodeUnit} from './by-code-unit.mjs';
import {removedOfKind} from './removed-vocabulary.mjs';

/** The effort vocabulary, ordered weakest to strongest — the only list of it. */
export const EFFORT_LEVELS=new Set(['none','minimal','low','medium','high','xhigh','max','ultra']);
const DIFFICULTIES=['easy','medium','hard','insane'];
const MODELS_KEYS=['tiers','seats','balance','usage'];
const known=names=>[...names].sort(byCodeUnit).join(', ');

const hasPath=(root,dotted)=>dotted.split('.').reduce((node,key)=>(plain(node)&&Object.hasOwn(node,key)?node[key]:undefined),root)!==undefined;

/** Refuse an old-shape config (the removed keys of modules/kernel/removed-vocabulary.yaml), naming every removed key and where its meaning lives now. */
export function refuseRemovedKeys(config){
  const found=removedOfKind('config-key').filter(({name})=>hasPath(config,name));
  if(!found.length)return;
  const removed=found.map(({name,use})=>`${name} is removed (${use})`).join('; ');
  throw new Error(`Invalid config.yaml: ${removed}.`);
}

let shippedCache=null;
/** modules/models/tiers.yaml as shipped, parsed once per file version. */
export function shippedTiers(){
  const file=fileURLToPath(new URL('../modules/models/tiers.yaml',import.meta.url));
  let stat;try{stat=fs.statSync(file);}catch{throw new Error('Missing modules/models/tiers.yaml');}
  const version=`${stat.mtimeMs}:${stat.size}`;
  if(shippedCache?.version!==version)shippedCache={version,doc:parseYaml(fs.readFileSync(file,'utf8'))};
  return structuredClone(shippedCache.doc);
}

function validateMember(bad,where,member,profile){
  if(!plain(member)||Object.keys(member).some(key=>!['agent','model','effort'].includes(key))||typeof member.agent!=='string'||typeof member.model!=='string')
    bad(`${where} must be {agent, model, effort?}.`);
  if(profile.models?.[member.model]?.provider!==member.agent)bad(`${where}: model ${member.model} is not declared by agent ${member.agent} in modules/models/registry.yaml models.`);
  if(member.effort!==undefined&&!EFFORT_LEVELS.has(member.effort))bad(`${where}.effort must use the effort vocabulary.`);
}

function validateChains(bad,tiers,profile){
  for(const [name,chain] of Object.entries(tiers)){
    if(!Array.isArray(chain)||!chain.length)bad(`.${name} must be a non-empty ordered list of {agent, model, effort?}.`);
    chain.forEach((member,index)=>validateMember(bad,`.${name}[${index}]`,member,profile));
    if(new Set(chain.map(member=>`${member.agent}/${member.model}`)).size!==chain.length)bad(`.${name} names each member once.`);
  }
}

/** A call tier is taken by a headless call only: no seat, difficulty, kind, order or caller reference may name it, and every call names one. */
function validateUse(bad,{doc,names,refs}){
  const callTiers=new Set(Object.entries(doc.tierUse).filter(([,use])=>use==='call').map(([tier])=>tier));
  for(const tier of Object.keys(doc.tierUse))if(!names.has(tier))bad(`: tierUse names tier ${tier} (known: ${known(names)}).`);
  for(const [where,tier] of refs)if(callTiers.has(tier))bad(`: ${where} names tier ${tier}, a call tier (tierUse): a headless call is made on it, no seat or op is seated on it.`);
  for(const [call,spec] of Object.entries(doc.calls))if(!callTiers.has(spec.tier))bad(`: calls.${call}.tier ${spec.tier} must be a tier whose tierUse is call.`);
}

/** The tier document the picker reads: the shipped tiers.yaml with config.yaml `models` laid over it. Validated. */
export function effectiveTiers(config,profile){
  const doc=shippedTiers(),models=plain(config?.models)?config.models:{};
  const bad=invalid('models');
  const tiers={...doc.tiers,...models.tiers};
  validateChains(bad,tiers,profile);
  const seats={...doc.seats,...models.seats};
  const balance={...doc.balance,...models.balance};
  const usage={...doc.usage,...models.usage};
  const names=new Set(Object.keys(tiers));
  const refs=[...Object.entries(seats).map(([seat,tier])=>[`.seats.${seat}`,tier]),...DIFFICULTIES.map(level=>[`difficulty.${level}`,doc.difficulty[level]]),
    ...Object.entries(doc.kindTiers).map(([kind,tier])=>[`kindTiers.${kind}`,tier]),...doc.tierOrder.map(tier=>['tierOrder',tier])];
  for(const [where,tier] of refs)if(!names.has(tier))bad(`: ${where} names tier ${tier} (known: ${known(names)}).`);
  validateUse(bad,{doc,names,refs});
  if(!(Number.isInteger(balance.maxStreak)&&balance.maxStreak>=1))bad('.balance.maxStreak must be an integer >= 1.');
  if(!(typeof balance.maxSharePercent==='number'&&balance.maxSharePercent>0&&balance.maxSharePercent<=100))bad('.balance.maxSharePercent must be a number in (0, 100].');
  const {reservePercent,biasPercent,exhaustedPercent}=usage;
  if(![reservePercent,biasPercent,exhaustedPercent].every(value=>typeof value==='number'&&value>=0&&value<=100)||!(reservePercent<=biasPercent&&biasPercent<exhaustedPercent))
    bad('.usage must hold numbers with reservePercent <= biasPercent < exhaustedPercent, each within 0..100.');
  return {...doc,tiers,seats,balance,usage};
}

/** config.yaml `models` — {tiers?, seats?, balance?, usage?}; the shipped defaults make every key optional. */
export function validateModelsBlock(config,profile){
  refuseRemovedKeys(config);
  const models=config?.models;
  if(models===undefined||models===null)return;
  const bad=invalid('models');
  if(!plain(models)||Object.keys(models).some(key=>!MODELS_KEYS.includes(key)))bad(` must be {${MODELS_KEYS.map(key=>key+'?').join(', ')}} or null (unknown keys are refused).`);
  if(models.tiers!==undefined&&!plain(models.tiers))bad('.tiers must map tier names to ordered member lists.');
  for(const key of ['seats','balance','usage'])if(models[key]!==undefined&&!plain(models[key]))bad(`.${key} must be a mapping.`);
  effectiveTiers(config,profile);
}
