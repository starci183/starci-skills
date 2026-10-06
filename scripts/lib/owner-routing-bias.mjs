// Owner intent normalization. This preserves constraints; it never grants launch or budget authority.
import { isPlainObject } from '../../engine/plain-object.mjs';
import { allocationSettings } from '../../engine/config.mjs';
import { admissionRoles, admissionSelectorFields } from './agent-admission.mjs';

const POOLS = Object.freeze({codex:'codex-agent','codex-agent':'codex-agent',claude:'claude-agent','claude-agent':'claude-agent',devin:'devin-agent','devin-agent':'devin-agent'});
const PROVIDERS = Object.freeze({codex:'codex',openai:'codex',claude:'claude',anthropic:'claude',devin:'devin',cursor:'cursor'});
const plain = value => isPlainObject(value) && [Object.prototype,null].includes(Object.getPrototypeOf(value));
export const canonicalRoutingPool = value => typeof value === 'string' ? POOLS[value.trim().toLowerCase()] : undefined;
const defaultRoles = () => {
  const policy = allocationSettings().admission;
  const roles = policy?.ownerBiasRoles;
  if (!Array.isArray(roles) || !roles.length || roles.some(value => !admissionRoles(policy).includes(value)))
    throw invalid('allocation.admission.ownerBiasRoles must declare valid default roles');
  return roles;
};
const invalid = message => Object.assign(new Error(`Invalid owner routing bias: ${message}`),{code:'invalid-owner-routing-bias'});
const text = (value,key) => {
  if(typeof value !== 'string' || !value.trim())throw invalid(`${key} must be a nonempty string`);
  return value.trim();
};
const keys = (value,allowed,label) => {
  if(!plain(value))throw invalid(`${label} must be a plain object`);
  const unknown=Object.keys(value).filter(key=>!allowed.includes(key));
  if(unknown.length)throw invalid(`${label} has unknown fields: ${unknown.join(', ')}`);
};
const provider = value => {
  const found=PROVIDERS[text(value,'provider').toLowerCase()];
  if(!found)throw invalid('provider is not declared');
  return found;
};
const pool = value => {
  const found=POOLS[text(value,'pool').toLowerCase()];
  if(!found)throw invalid('pool is not declared');
  return found;
};
const selector = value => {
  keys(value,admissionSelectorFields,'selector');
  if(!Object.keys(value).length)throw invalid('selector must constrain a pool, provider or model');
  const result={};
  if(value.pool!==undefined)result.pool=pool(value.pool);
  if(value.provider!==undefined)result.provider=provider(value.provider);
  if(value.model!==undefined)result.model=text(value.model,'model');
  const family=result.pool?.replace(/-agent$/,'');
  if(family && result.provider && family!==result.provider)throw invalid('selector pool and provider conflict');
  return result;
};
const role = value => {
  const found=text(value,'role').toLowerCase();
  if(!admissionRoles(allocationSettings().admission).includes(found))throw invalid('role is not declared');
  return found;
};
const canonicalList = value => {
  if(value===undefined || value===null)return [];
  if(!Array.isArray(value))throw invalid('prefer and avoid must be arrays');
  const result=[];
  const seen=new Set();
  for(const item of value){
    // String preferences drop an unknown alias. Hard selectors never drop fields.
    const normalized=typeof item==='string'?canonicalRoutingPool(item):selector(item);
    if(!normalized)continue;
    const key=JSON.stringify(normalized);
    if(!seen.has(key)){seen.add(key);result.push(normalized);}
  }
  return result;
};
const asSelector = value => typeof value==='string'?{pool:value}:value;
const covers = (excluded,required) => {
  const a=asSelector(excluded),b=asSelector(required);
  const family=value=>value.provider??value.pool?.replace(/-agent$/,'');
  const matches = ([key,value]) => {
    if (key === 'provider') return family(b) === value;
    if (key === 'pool') return b.pool === value || family(b) === value.replace(/-agent$/,'');
    return b[key] === value;
  };
  return Object.entries(a).every(matches);
};
const override = value => {
  keys(value,['authorized','scopeId','role','provider','model','account','reason'],'reserveOverride');
  if(value.authorized!==true)throw invalid('reserveOverride requires an explicit authorized owner grant');
  const result={authorized:true,scopeId:text(value.scopeId,'scopeId'),role:role(value.role),provider:provider(value.provider),model:text(value.model,'model'),reason:text(value.reason,'reason')};
  if(value.account!==undefined)result.account=text(value.account,'account');
  return result;
};

/** Normalize owner-authored data. Authorization is independently checked by the admission adapter. */
export function normalizeOwnerRoutingBias(value){
  if(value===undefined || value===null)value={};
  keys(value,['prefer','avoid','require','reserveOverride','roles'],'bias');
  const avoid=canonicalList(value.avoid);
  const prefer=canonicalList(value.prefer).filter(item=>!avoid.some(excluded=>covers(excluded,item)));
  const result={prefer,avoid};
  if(value.require!==undefined && value.require!==null){
    result.require=selector(value.require);
    if(avoid.some(excluded=>covers(excluded,result.require)))throw invalid('require conflicts with avoid');
  }
  if(value.reserveOverride!==undefined && value.reserveOverride!==null)result.reserveOverride=override(value.reserveOverride);
  if(value.roles!==undefined){
    if(!Array.isArray(value.roles) || !value.roles.length)throw invalid('roles must be a nonempty array');
    result.roles=[...new Set(value.roles.map(role))];
  }
  if(result.reserveOverride && !(result.roles??defaultRoles()).includes(result.reserveOverride.role))throw invalid('reserveOverride role is outside the bias roles');
  return result;
}

/** Scope persisted owner intent to one actor; a grant for another attempt never leaks into this one. */
export function biasForRole(value,requestedRole,scopeId){
  const bias=normalizeOwnerRoutingBias(value);
  const actor=role(requestedRole);
  if(!(bias.roles??defaultRoles()).includes(actor))return {prefer:[],avoid:[]};
  const reserveOverride=bias.reserveOverride;
  const scoped={prefer:bias.prefer,avoid:bias.avoid};
  if(bias.require)scoped.require=bias.require;
  if(reserveOverride && reserveOverride.role===actor && reserveOverride.scopeId===scopeId)scoped.reserveOverride=reserveOverride;
  return scoped;
}
