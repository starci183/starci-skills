import {isPlainObject as plain} from './plain-object.mjs';
import {invalid} from './invalid-config.mjs';

/**
 * config.yaml `orca` — the owner's Orca app settings the runtime must know. maxWorkerDepth is the deepest worker Orca
 * lets start under the owner's chat (chat = depth 0, a Kernel or the [Supervisor] 1, an op or a [Worker] 2, the draw
 * critic 3); a deeper worker-start is refused by Orca with nested_worker_depth_exceeded. Orca exposes no read of that
 * setting, so it is declared here and MUST equal the Orca app setting: scripts/agent/lib.mjs spawnAgent refuses a launch
 * deeper than it before worker-start (worker-depth-exceeded), and `start --check` with STARCI_ORCA_LIVE=1 compares it with
 * a measured probe (scripts/agent/depth-probe.mjs).
 */
export const ORCA_DEFAULTS=Object.freeze({maxWorkerDepth:4});
export const MAX_WORKER_DEPTH_CEILING=16;
export function validateOrca(orca){
  if(orca===null)return;
  const bad=invalid('orca');
  if(!plain(orca))bad(' must be {maxWorkerDepth?} or null.');
  for(const key of Object.keys(orca))if(key!=='maxWorkerDepth')bad(` has unknown key ${key} (allowed: maxWorkerDepth).`);
  const v=orca.maxWorkerDepth;
  if(v!==undefined&&v!==null&&!(Number.isInteger(v)&&v>=1&&v<=MAX_WORKER_DEPTH_CEILING))bad(`.maxWorkerDepth must be an integer from 1 to ${MAX_WORKER_DEPTH_CEILING} equal to the Orca app's worker depth setting (default ${ORCA_DEFAULTS.maxWorkerDepth}), or null.`);
}
/** The owner's Orca settings: {maxWorkerDepth, source: 'orca'|'default'}. An absent or null block or key is the default. */
export function orcaSettings(config){
  if(config?.orca!==undefined)validateOrca(config.orca);
  const value=plain(config?.orca)?config.orca.maxWorkerDepth:null;
  return Number.isInteger(value)?{maxWorkerDepth:value,source:'orca'}:{maxWorkerDepth:ORCA_DEFAULTS.maxWorkerDepth,source:'default'};
}
