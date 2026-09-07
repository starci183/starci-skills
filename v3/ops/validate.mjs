import fs from 'node:fs';
import path from 'node:path';

const nonempty = value=>typeof value==='string'&&value.trim().length>0;
const safeRelative = value=>nonempty(value)&&!path.posix.isAbsolute(value)&&!path.win32.isAbsolute(value)&&!value.split(/[\\/]/).some(p=>p==='..'||p==='.')&&!value.includes('\\');
const unique = values=>new Set(values).size===values.length;
const pair = value=>value&&nonempty(value.en)&&nonempty(value.vi);
const issue = (errors,code,subject,message)=>errors.push({code,subject,message});

// Validates authoring/catalogue referential integrity, NOT real-world execution or truth.
// Never executes an op, resolves a credential, fetches a URL or mutates a workspace.
export function validateCatalog(catalog,{root,legacyRoot,profiles}={}) {
  const errors=[];
  if(!catalog||catalog.schema!=='work/ops@1'||!Array.isArray(catalog.ops)) return {ok:false,errors:[{code:'CATALOG_SCHEMA',subject:'catalog',message:'Expected work/ops@1 and ops array'}]};
  function fileRef(ref,subject,english=true) {
    if(!safeRelative(ref)||(english&&ref.endsWith('.vi.md'))) {issue(errors,'DOCUMENT_PATH',subject,'Unsafe/non-authority document path');return;}
    if(root) {
      const full=path.resolve(root,ref), relative=path.relative(root,full);
      if(relative.startsWith('..')||!fs.existsSync(full)||!fs.statSync(full).isFile()||fs.lstatSync(full).isSymbolicLink()) issue(errors,'DOCUMENT_MISSING',subject,'Document must be a regular file inside ops root');
      else if(!fs.readFileSync(full,'utf8').trim()) issue(errors,'DOCUMENT_EMPTY',subject,'Document is empty');
    }
  }
  fileRef(catalog.commonDocument,'common');
  if(!unique(catalog.ops.map(o=>o.id))) issue(errors,'DUPLICATE_OP','catalog','Operator IDs must be unique');
  if(!unique(catalog.ops.map(o=>o.document))) issue(errors,'DUPLICATE_DOCUMENT','catalog','Each op must own its document');
  for(const op of catalog.ops) {
    const at=op.id;
    if(!/^[a-z]+(?:\.[a-z]+)+$/.test(at??'')) issue(errors,'OP_ID',at,'Invalid operator ID');
    fileRef(op.document,at);fileRef(op.mirror,at,false);
    for(const ref of op.supportingReferences??[]) {
      if(!safeRelative(ref.path)||!nonempty(ref.when)||!nonempty(ref.whenVi)) issue(errors,'DOMAIN_REFERENCE',at,'Reference requires safe repo-relative source and bilingual applicability');
      else if(legacyRoot&&!fs.existsSync(path.resolve(legacyRoot,ref.path))) issue(errors,'DOMAIN_REFERENCE',at,'Referenced domain source does not exist');
    }
    if(op.mirror!==op.document?.replace(/\.md$/,'.vi.md')) issue(errors,'MIRROR_PATH',at,'Mirror must share the English stem');
    if(!nonempty(op.goal)||!Array.isArray(op.nodeKinds)||!op.nodeKinds.includes(op.completionProfile)) issue(errors,'PROFILE',at,'Goal and compatible profile required');
    if(profiles&&!Object.hasOwn(profiles,op.completionProfile)) issue(errors,'UNKNOWN_PROFILE',at,'Completion profile is not supported by core');
    if(!Array.isArray(op.writeScope)||!op.writeScope.length||!Array.isArray(op.sideEffects)) issue(errors,'WRITE_SCOPE',at,'Write scope/effects declaration required');
    const c=op.contract;
    if(!c||c.id!==at||!pair(c.goal)||!Array.isArray(c.reads)||!Array.isArray(c.writes)||!Array.isArray(c.steps)||!Array.isArray(c.proofs)||!Array.isArray(c.blockers)) {issue(errors,'CONTRACT',at,'Detailed bilingual contract required');continue;}
    if(!c.reads.length||!c.writes.length||!c.steps.length||!c.proofs.length||!c.blockers.length) issue(errors,'EMPTY_CONTRACT',at,'Reads/writes/steps/proofs/blockers cannot be empty');
    if(!c.graphPolicy||!['read-only','selected-scope-only'].includes(c.graphPolicy.mode)||c.graphPolicy.prerequisiteState!=='done'||c.graphPolicy.dispatch!=='never'||c.graphPolicy.location!=='.work node dependsOn/refs and resource files') issue(errors,'GRAPH_POLICY',at,'Graph authority must live in .work, require done prerequisites and never dispatch automatically');
    if(c.graphPolicy?.mode==='read-only'&&c.writes.some(w=>w.id==='node'&&w.fields?.some(f=>['dependsOn','refs','required'].includes(f)))) issue(errors,'CONSUMER_GRAPH_WRITE',at,'A consumer op cannot silently rewrite scope/input graph fields');
    if(c.goal.en!==op.goal||c.completionProfile!==op.completionProfile||JSON.stringify(c.sideEffects)!==JSON.stringify(op.sideEffects)) issue(errors,'CATALOG_DRIFT',at,'Summary and contract differ');
    if(JSON.stringify(c.writes.map(w=>w.path))!==JSON.stringify(op.writeScope)) issue(errors,'WRITE_SCOPE_DRIFT',at,'Write scope must derive from write matrix');
    const readIds=c.reads.map(r=>r.id),writeIds=c.writes.map(w=>w.id);
    if(!unique(readIds)||!unique(writeIds)) issue(errors,'DUPLICATE_BINDING',at,'Read/write IDs must be unique');
    for(const row of [...c.reads,...c.writes]) {
      if(!nonempty(row.id)||!nonempty(row.path)||!pair(row.purpose??row.content)) issue(errors,'BINDING_SHAPE',at,'Every binding needs ID/path and bilingual purpose');
      for(const match of (row.path??'').matchAll(/<([^>]+)>/g)) if(!nonempty(c.placeholders?.[match[1]])) issue(errors,'UNDEFINED_PLACEHOLDER',at,match[1]);
      if(/(?:^|[ /])\.\.(?:[ /]|$)|[A-Za-z]:[\\/]|~[\\/]/.test(row.path??'')) issue(errors,'UNSAFE_TEMPLATE',at,row.path);
    }
    for(const w of c.writes) {
      if(!Array.isArray(w.fields)||!w.fields.length||!w.fields.every(nonempty)) issue(errors,'WRITE_FIELDS',at,w.id+' has no field/content matrix');
      if(!/^(?:N\/node\.md|E\/|\.work\/|repository:<repo-id>\/)/.test(w.path??'')) issue(errors,'WRITE_DESTINATION',at,'Write must target explicit .work node/resource/evidence or bound source repository');
      if(w.path?.startsWith('repository:')&&w.id!=='source') issue(errors,'SOURCE_SCOPE',at,'Product source writes need explicit source binding');
    }
    const usedReads=new Set(),usedWrites=new Set();
    for(const [i,s] of c.steps.entries()) {
      if(!pair(s.action)||!Array.isArray(s.reads)||!Array.isArray(s.writes)) {issue(errors,'STEP_SHAPE',at,`Step ${i+1} incomplete`);continue;}
      for(const id of s.reads) {usedReads.add(id);if(!readIds.includes(id)) issue(errors,'UNDECLARED_READ',at,`Step ${i+1}: ${id}`);}
      for(const id of s.writes) {usedWrites.add(id);if(!writeIds.includes(id)) issue(errors,'UNDECLARED_WRITE',at,`Step ${i+1}: ${id}`);}
    }
    for(const id of readIds) if(!usedReads.has(id)) issue(errors,'UNUSED_READ',at,id);
    for(const id of writeIds) if(!usedWrites.has(id)) issue(errors,'UNREACHABLE_WRITE',at,id);
    if(writeIds.includes('source')&&(!readIds.includes('repo')||!op.sideEffects.length)) issue(errors,'SOURCE_AUTHORITY',at,'Source writes need repository grounding and declared effects');
    if(!unique(c.proofs.map(p=>p.id))||!c.proofs.every(p=>nonempty(p.id)&&pair(p.requirement))) issue(errors,'PROOF_SHAPE',at,'Proof identities and bilingual requirements required');
    if(!unique(c.blockers.map(b=>b.code))||!c.blockers.every(b=>/^[A-Z][A-Z_]+$/.test(b.code)&&pair(b.condition))) issue(errors,'BLOCKER_SHAPE',at,'Concrete bilingual blocker conditions required');
  }
  const mappings=catalog.legacyMappings;
  if(!Array.isArray(mappings)||!unique(mappings.map(m=>m.legacy))) issue(errors,'LEGACY_MAPPING','catalog','Unique legacy mappings required');
  else {
    const ids=new Set(catalog.ops.map(o=>o.id));
    for(const m of mappings) {
      if(!ids.has(m.replacement)||!nonempty(m.change)||m.disposition!=='preserved-scope-replaced-protocol') issue(errors,'LEGACY_TARGET',m.legacy,'Legacy replacement or disposition invalid');
      if(!safeRelative(m.source)) issue(errors,'LEGACY_PATH',m.legacy,'Unsafe source citation');
      if(legacyRoot&&safeRelative(m.source)) {
        const full=path.resolve(legacyRoot,m.source);
        if(!fs.existsSync(full)||!fs.readFileSync(full,'utf8').startsWith('# '+m.legacy)) issue(errors,'LEGACY_SOURCE',m.legacy,'Original operator source/title missing');
      }
    }
    if(legacyRoot) {
      const observed=fs.readdirSync(path.join(legacyRoot,'operators'),{withFileTypes:true}).filter(e=>e.isDirectory()&&fs.existsSync(path.join(legacyRoot,'operators',e.name,'operator.md'))).map(e=>fs.readFileSync(path.join(legacyRoot,'operators',e.name,'operator.md'),'utf8').split(/\r?\n/)[0].replace(/^# /,'')).sort();
      if(JSON.stringify(observed)!==JSON.stringify(mappings.map(m=>m.legacy).sort())) issue(errors,'LEGACY_COVERAGE','catalog','Mapping must cover every actual legacy operator exactly once');
    }
  }
  return {ok:errors.length===0,errors};
}
