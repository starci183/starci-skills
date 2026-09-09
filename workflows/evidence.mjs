import fs from 'node:fs';
import path from 'node:path';
import {stateRoot} from './storage.mjs';
import {previewEvidence,sha256,canonicalJSON} from '../core/index.mjs';
import {parseYaml} from '../core/yaml.mjs';
import {scopedWorkStatus} from './work-binding.mjs';
const within=(base,file)=>{const r=path.relative(base,file);return r!== '..'&&!r.startsWith('..'+path.sep)&&!path.isAbsolute(r);};
function snapshot(dir) {
 const entries=[];
 const walk=p=>{for(const ent of fs.readdirSync(p,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const file=path.join(p,ent.name);if(ent.isSymbolicLink())throw Error('Evidence cannot follow links');if(ent.isDirectory())walk(file);else entries.push([path.relative(dir,file),sha256(fs.readFileSync(file))]);}};
 walk(dir);return sha256(canonicalJSON(entries));
}
function staging(workRoot,directory) {
 const root=fs.realpathSync(workRoot),stage=fs.realpathSync(directory);
 const stagingRoot=path.join(stateRoot(root),'evidence-staging');
 if(!within(stagingRoot,stage)||stage===stagingRoot||fs.realpathSync(path.dirname(stage))!==stagingRoot||fs.lstatSync(directory).isSymbolicLink())throw Error('Use a direct owned staging directory under '+stagingRoot);
 return {root,stage};
}
/** Scoped publication preview; global validator diagnostics remain unchanged.
 * See docs/scoped-evidence-publication.md. This grants neither effects nor done. */
export function previewEvidencePublication(workRoot,{directory,nodeId,name}) {
 try {
  const {root,stage}=staging(workRoot,directory),work=previewEvidence(root,{directory:stage,nodeId,name});
  const manifest=parseYaml(fs.readFileSync(path.join(stage,'manifest.yaml'),'utf8'));
  const bindings=[{nodeId,inputDigest:manifest?.inputDigest},...(Array.isArray(manifest?.bindings)?manifest.bindings:[])];
  const ids=[...new Set(bindings.map(b=>b?.nodeId))],verdict=scopedWorkStatus(work,ids,{requiredChildrenOnly:true});
  const errors=[...verdict.errors],blocked=new Set(verdict.blocked);
  for(const binding of bindings){
   const n=work.nodes.find(n=>n.id===binding?.nodeId);
   if(!n||binding.inputDigest!==n.inputDigest)errors.push({code:'EVIDENCE_CURRENT_BINDING',path:n?.path??'.',message:'New evidence must bind the current input digest of every named owner.'});
   if(n&&(!n.eligible||['invalid','uninvestigate','suspended','blocked'].includes(n.effectiveState)))blocked.add(n.id);
  }
  const owner=work.nodes.find(n=>n.id===nodeId);
  return {...verdict,ok:!errors.length&&!verdict.missing.length&&!blocked.size,errors,blocked:[...blocked],preview:true,nodeId,...(owner?{path:path.join(root,path.dirname(owner.path),'evidence',name)}:{})};
 }catch{return {ok:false,globalOk:false,preview:true,nodeId,errors:[{code:'EVIDENCE_PREVIEW',path:'.',message:'Invalid staged evidence or staging location; nothing was published.'}],remainingErrors:[],missing:[],blocked:[]};}
}
/** Publish a complete new bundle in one same-filesystem directory rename; never overwrite. */
export function publishEvidence(workRoot,{directory,nodeId,name}) {
 const {root,stage}=staging(workRoot,directory),seal=snapshot(stage);
 const preview=previewEvidencePublication(root,{directory:stage,nodeId,name});
 if(!preview.ok)throw Error('Evidence preflight failed: '+JSON.stringify({errors:preview.errors,missing:preview.missing,blocked:preview.blocked}));
 const destination=preview.path,parent=path.dirname(destination);
 let cursor=parent;while(cursor!==root){if(!within(root,cursor)||fs.existsSync(cursor)&&fs.lstatSync(cursor).isSymbolicLink())throw Error('Evidence destination escapes Work');const next=path.dirname(cursor);if(next===cursor)throw Error('Invalid evidence owner path');cursor=next;}
 if(fs.existsSync(destination))throw Error('Published evidence is immutable; use a fresh evidence name');
 if(snapshot(stage)!==seal)throw Error('Staged evidence changed after preflight');
 fs.mkdirSync(parent,{recursive:true});
 fs.renameSync(stage,destination);
 return {path:destination,nodeId,seal,published:true,globalOk:preview.globalOk,remainingErrors:preview.remainingErrors};
}
