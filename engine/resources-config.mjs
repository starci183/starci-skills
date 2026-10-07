import {isPlainObject as plain} from './plain-object.mjs';
import {invalid} from './invalid-config.mjs';

/**
 * config.yaml `resources` — the owner's host-capacity floors, which override the shipped numbers of
 * modules/models/runtimes.yaml `allocation.resources`. minFreeDiskGb: the free space a drive holding the temp root or the
 * repository must keep before `starci kernel dispatch --spawn` launches another worker. minFreeDiskPct: the same floor as a
 * percentage of the drive's size; when both are set the larger requirement applies. minFreeRamPct: the free-RAM floor below
 * which no new heavy op starts. A null or absent key leaves the shipped number.
 */
const FLOOR_LIMITS=Object.freeze({minFreeDiskGb:Infinity,minFreeDiskPct:100,minFreeRamPct:100});
const inRange=(value,limit)=>typeof value==='number'&&Number.isFinite(value)&&value>0&&value<=limit;

export function validateResources(resources){
  if(resources===null)return;
  const bad=invalid('resources');
  const keys=Object.keys(FLOOR_LIMITS);
  if(!plain(resources))bad(` must be {${keys.map(key=>`${key}?`).join(', ')}} or null.`);
  for(const key of Object.keys(resources))if(!keys.includes(key))bad(` has unknown key ${key} (allowed: ${keys.join(', ')}).`);
  for(const key of keys){
    const value=resources[key];
    if(value!==undefined&&value!==null&&!inRange(value,FLOOR_LIMITS[key]))bad(`.${key} must be a number above 0${FLOOR_LIMITS[key]===Infinity?'':` and at most ${FLOOR_LIMITS[key]}`}, or null.`);
  }
}

const declared=(block,key,source)=>{
  const value=block?.[key];
  if(value===undefined||value===null)return null;
  if(!inRange(value,FLOOR_LIMITS[key]))throw new Error(`${source}.${key} must be a number above 0 (at most ${FLOOR_LIMITS[key]})`);
  return value;
};

/**
 * The floors in force: the owner's `resources` (config.yaml) over the shipped `allocation.resources`.
 * {minFreeDiskGb, minFreeDiskPct (null when unset), minFreeRamPct}. The shipped policy owns the default numbers: when it
 * omits or misspells minFreeDiskGb or minFreeRamPct this refuses, there is no fallback constant.
 */
export function hostFloors(shipped,owner=null){
  const source='modules/models/runtimes.yaml allocation.resources';
  const base={minFreeDiskGb:declared(shipped,'minFreeDiskGb',source),minFreeDiskPct:declared(shipped,'minFreeDiskPct',source),minFreeRamPct:declared(shipped,'minFreeRamPct',source)};
  for(const key of ['minFreeDiskGb','minFreeRamPct'])if(base[key]===null)throw new Error(`${source}.${key} must declare a positive number`);
  if(owner!==null&&owner!==undefined)validateResources(owner);
  const pick=key=>declared(owner,key,'config.yaml resources')??base[key];
  return {minFreeDiskGb:pick('minFreeDiskGb'),minFreeDiskPct:pick('minFreeDiskPct'),minFreeRamPct:pick('minFreeRamPct')};
}
