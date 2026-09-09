import fs from 'node:fs';
import path from 'node:path';
import {stateRoot} from './storage.mjs';
import {previewEvidence,validateWorkspace,sha256,canonicalJSON} from '../core/index.mjs';
const within=(base,file)=>{const r=path.relative(base,file);return r!== '..'&&!r.startsWith('..'+path.sep)&&!path.isAbsolute(r);};
function snapshot(dir) {
 const entries=[];
 const walk=p=>{for(const ent of fs.readdirSync(p,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const file=path.join(p,ent.name);if(ent.isSymbolicLink())throw Error('Evidence cannot follow links');if(ent.isDirectory())walk(file);else entries.push([path.relative(dir,file),sha256(fs.readFileSync(file))]);}};
 walk(dir);return sha256(canonicalJSON(entries));
}
/** Publish a complete new bundle in one same-filesystem directory rename; never overwrite. */
export function publishEvidence(workRoot,{directory,nodeId,name}) {
 const root=fs.realpathSync(workRoot),stage=fs.realpathSync(directory),project=path.dirname(root);
 const stagingRoot=path.join(stateRoot(root),'evidence-staging');
 if(!within(stagingRoot,stage)||stage===stagingRoot||fs.realpathSync(path.dirname(stage))!==stagingRoot||fs.lstatSync(directory).isSymbolicLink())throw Error('Use a direct owned staging directory under '+stagingRoot);
 const current=validateWorkspace(root),owner=current.nodes.find(n=>n.id===nodeId);
 if(!current.ok||!owner)throw Error('Valid Work and an existing evidence owner are required');
 const seal=snapshot(stage),preview=previewEvidence(root,{directory:stage,nodeId,name});
 if(!preview.ok)throw Error('Evidence preflight failed: '+JSON.stringify(preview.errors));
 const parent=path.join(root,path.dirname(owner.path),'evidence'),destination=path.join(parent,name);
 let cursor=parent;while(cursor!==root){if(!within(root,cursor)||fs.existsSync(cursor)&&fs.lstatSync(cursor).isSymbolicLink())throw Error('Evidence destination escapes Work');const next=path.dirname(cursor);if(next===cursor)throw Error('Invalid evidence owner path');cursor=next;}
 if(fs.existsSync(destination))throw Error('Published evidence is immutable; use a fresh evidence name');
 if(snapshot(stage)!==seal)throw Error('Staged evidence changed after preflight');
 fs.mkdirSync(parent,{recursive:true});
 fs.renameSync(stage,destination);
 return {path:destination,nodeId,seal,published:true};
}
