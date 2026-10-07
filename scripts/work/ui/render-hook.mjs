import fs from 'node:fs';
import path from 'node:path';
import {slash} from '../../lib/path-key.mjs';
import {check,runRenderChecks} from './render.mjs';

// ---------------------------------------------------------------------------
// The kernel hook.
// ---------------------------------------------------------------------------

const TRAILING_STAR_SEGMENT=/\/\*+$/;
const TRAILING_SLASHES=/(?<!\/)\/+$/;
const NODE_SEGMENT=/(^|\.starciwork\/)features\/[^/]+\/ui(\/|$)/;
const ALPHANUMERIC=/^[A-Za-z0-9]+$/;
/** Whether the path ends in a file name: some `.` followed by letters or digits to the end. */
const endsInExtension=value=>{
  const dot=value.lastIndexOf('.');
  return dot>=0&&ALPHANUMERIC.test(value.slice(dot+1));
};

/**
 * The ui node an operation wrote, from the allowlist it was given or from the files its diff touched. An
 * allowlist names either the record (`.../ui/<node>/index.yaml`) or the folder (`.../ui/<node>/**`), and a
 * diff names the record; all three point at the same directory, which is what the checks read.
 */
export function uiDirOf({op={},files=[]}={}){
  const paths=[...(Array.isArray(op.references)?op.references:[]),...(Array.isArray(op.allowlist)?op.allowlist:[]),...(Array.isArray(files)?files:[])].map(slash).filter(Boolean);
  for(const entry of paths){
    const trimmed=entry.replace(TRAILING_STAR_SEGMENT,'').replace(TRAILING_SLASHES,'');
    // Only a canonical Work UI node is a design input. Grammar references can contain their own `ui/`
    // segment and must never win merely because they appear earlier in an operation's reference list.
    if(!NODE_SEGMENT.test(trimmed))continue;
    return endsInExtension(trimmed)?path.posix.dirname(trimmed):trimmed;
  }
  return null;
}
const renderWorkRoot=(at,repoRoot)=>{if(at.workRoot){return path.resolve(String(at.workRoot));}if(repoRoot){return path.join(repoRoot,'.starciwork');}return null;};
const renderUiDirectory=(declared,normalized,repoRoot,workRoot)=>{if(path.isAbsolute(declared)){return path.resolve(declared);}if(normalized.startsWith('.starciwork/')){return path.resolve(repoRoot??path.dirname(workRoot),...normalized.split('/'));}return path.resolve(workRoot,...normalized.split('/'));};
const renderCaptureOwner=(node,inferred)=>{if(node?.path){return path.posix.dirname(slash(node.path));}if(inferred){return inferred.replace(/\/assets(?:\/.*)?$/,'');}return null;};
const renderCaptureDirectory=(captureDeclared,captureNormalized,repoRoot,workRoot)=>{if(!captureDeclared){return null;}if(path.isAbsolute(captureDeclared)){return path.resolve(captureDeclared);}if(captureNormalized.startsWith('.starciwork/')){return path.resolve(repoRoot??path.dirname(workRoot),...captureNormalized.split('/'));}return path.resolve(workRoot,...captureNormalized.split('/'));};

/** One failed proof, or `null` (no hook) when the operation does not require implementation proof. */
const unprovenUnless=(required,id,detail,evidence)=>required?{ok:false,checks:[check(id,'fail',detail,evidence)]}:null;

/** The checks that must not be skipped for an implementation to count as proven. */
const CORE_CHECKS=new Set(['palette-off-brand','primary-absent','entity-list-in-card']);

/** The proof of a frontend operation whose ui node and Work root resolved: its capture owner, then every render check. */
function implementationProof({op,ctx,required,uiDir,repoRoot,workRoot}){
  const node=required&&op.nodeId&&typeof ctx?.work?.node==='function'?ctx.work.node(op.nodeId):null;
  const inferred=(Array.isArray(op.allowlist)?op.allowlist:[]).map(slash).find(item=>/(^|\/)implementation\/frontend(\/|$)/.test(item)&&/(^|\/)assets(\/|$)/.test(item));
  const captureDeclared=renderCaptureOwner(node,inferred);
  if(required&&!captureDeclared)return {ok:false,checks:[check('implementation-capture-owner-unbound','fail',
    'The frontend implementation has a UI design reference but no bound implementation node to own its running-page captures.',{uiDir:slash(uiDir),nodeId:op.nodeId??null})]};
  const captureNormalized=slash(captureDeclared??'').replace(/^\.\//,'');
  const captureDir=renderCaptureDirectory(captureDeclared,captureNormalized,repoRoot,workRoot);
  const result=runRenderChecks({uiDir,captureDir,brandTree:workRoot});
  if(result.node.candidates===0)return unprovenUnless(required,'implementation-capture-missing',
    'The frontend implementation references a UI design but declares no structural implementation capture; ImageGen direction pixels are not browser/Grammar proof.',{uiDir:slash(uiDir)});
  const incomplete=required?result.checks.filter(entry=>CORE_CHECKS.has(entry.id)&&entry.outcome==='skip'):[];
  if(incomplete.length)result.checks.push(check('implementation-render-proof-incomplete','fail',
    `The implementation capture left ${incomplete.map(entry=>entry.id).join(', ')} unproven; browser pixels and matching markup are required separately from ImageGen direction.`,{uiDir:slash(uiDir)}));
  return {ok:result.ok&&!incomplete.length,checks:result.checks};
}

/** A tree with no brand record, or a node with no `ui:` spec, is a broken input rather than a failed drawing. */
const unavailableProof=(required,error,uiDir,workRoot)=>({ok:!required,checks:[check(required?'implementation-render-proof-unavailable':'render-checks-unavailable',required?'fail':'skip',`The render checks could not run: ${String(error.message??error)}`,{uiDir:slash(uiDir),workRoot:slash(workRoot)})]});

/**
 * The render-proof hook of a frontend operation's ui node. Design-direction assets (ImageGen) return `null`:
 * their pixels are design input, not exact Grammar render/DOM proof. Implementation captures and browser UAT are
 * verified by their downstream operations.
 */
export function renderChecksFor({op={},state=null,ctx={},files=[]}={}){
  const required=['frontend.implement','interface.implement'].includes(op.kind);
  const declared=uiDirOf({op,files});
  if(!declared)return null;
  const at=ctx?.work?.at??{};
  const repoRoot=at.repoRoot?path.resolve(String(at.repoRoot)):null;
  const workRoot=renderWorkRoot(at,repoRoot);
  if(!workRoot)return unprovenUnless(required,'implementation-render-proof-unavailable',
    'The frontend implementation names a UI design input but its canonical Work root is not bound.',{declared:slash(declared)});
  const normalized=slash(declared).replace(/^\.\//,'');
  // Work references are normally relative to the Work root, while authored repository references retain their
  // `.starciwork/` namespace. Both must resolve to the same node instead of nesting `.starciwork/.starciwork`.
  const uiDir=renderUiDirectory(declared,normalized,repoRoot,workRoot);
  if(!fs.existsSync(path.join(uiDir,'index.yaml')))return unprovenUnless(required,'implementation-ui-input-missing',
    'The frontend implementation explicitly references a UI design input whose index.yaml is missing.',{declared:normalized,uiDir:slash(uiDir),workRoot:slash(workRoot)});
  try{
    return implementationProof({op,ctx,required,uiDir,repoRoot,workRoot});
  }catch(error){
    return unavailableProof(required,error,uiDir,workRoot);
  }
}
