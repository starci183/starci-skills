// The slice's own NEW findings (nivo auth inc-ee60a7c362a7; the Sonar slice rule 3e0b17f9c's principle).
//
// A scoped check-scoped-lint run over a slice's files used to gate on EVERY finding in each file the slice
// touched, including repository debt the slice never wrote (modules/auth/session.tsx useSession, a
// hook-location finding with ~20 importers: fixing it is a repo-wide refactor), so a slice touching an old
// file could never pass. The slice is now judged against its base (--base, default the merge-base of HEAD
// with its upstream): the same checks run on a base tree - the current working tree with the slice's files
// put back to their base blobs - and a located finding gates the slice only when it is NEW:
//   - its file did not exist at base (added-file),
//   - it sits on a line the slice changed (changed-line),
//   - its key (finding code + obligation + rule + file + normalized message) is absent at base (absent-at-base),
//   - or the slice made that key worse: more occurrences on unchanged lines than at base (more-than-base; each of
//     those gates - an extra occurrence on a changed line already gates as changed-line).
// Every other located finding on a slice file is PRE-EXISTING: a note with counts, owed to code.refactor (the
// repository's debt, measured by review.verify's --all run), never a finding against the slice.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {canonicalJSON} from '../../engine/index.mjs';

const clean=value=>String(value??'').replaceAll('\\','/').replace(/^\.\//,'');
const git=(cwd,args,{buffer=false}={})=>spawnSync('git',['-c','core.quotepath=off',...args],{cwd,encoding:buffer?'buffer':'utf8',windowsHide:true,maxBuffer:256*1024*1024});
const firstLine=value=>String(value??'').trim().split(/\r?\n/)[0]??'';

// Findings that carry a file (and usually a line) inside the slice: the only ones judged against the base.
// A script input gap on a slice file (SCRIPT_INPUT_UNAVAILABLE with a path) is that file's shape to make provable, so it is
// judged the same way; one without a path stays run-level.
export const LOCATED_FINDINGS=new Set(['LINT_MESSAGE','SUPPRESSED_MESSAGE','ARCHITECTURE_VIOLATION','SCRIPT_PATTERN_VIOLATION','SCRIPT_INPUT_UNAVAILABLE']);
const fileOf=issue=>clean(issue?.file??issue?.path??'');
const normalizedMessage=value=>String(value??'').replace(/\s+/g,' ').replace(/\b\d+:\d+\b/g,'#:#').replace(/\bline \d+\b/gi,'line #').trim();
export const findingKey=issue=>canonicalJSON([issue.code,issue.obligation??null,issue.ruleId??null,fileOf(issue),normalizedMessage(issue.message)]);
export const isLocatedFinding=issue=>LOCATED_FINDINGS.has(issue?.code)&&Boolean(fileOf(issue));
export const inRanges=(ranges,line)=>ranges.some(([from,to])=>line>=from&&line<=to);

/** The new-side line ranges per file of a `git diff -U0` patch (paths as the diff prints them, --relative). */
export function diffRanges(patch){
  const files=new Map();let current=null,header=false;
  const unquote=value=>/^".*"$/.test(value)?JSON.parse(value.replace(/\\([0-7]{3})/g,(_,octal)=>`\\u00${Number.parseInt(octal,8).toString(16).padStart(2,'0')}`)):value;
  for(const line of String(patch??'').split(/\r?\n/)){
    if(line.startsWith('diff --git ')){current={path:null,ranges:[]};header=true;continue;}
    if(!current)continue;
    if(line.startsWith('@@')){header=false;const hunk=/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);const start=Number(hunk?.[1]),count=hunk?.[2]===undefined?1:Number(hunk[2]);if(hunk&&count>0)current.ranges.push([start,start+count-1]);continue;}
    if(header&&line.startsWith('+++ ')&&line!=='+++ /dev/null'){current.path=clean(unquote(line.slice(4)).replace(/^b\//,''));files.set(current.path,current.ranges);}
  }
  return files;
}

/**
 * Resolve the slice base. An explicit --base must be a commit (else SLICE_BASE_UNKNOWN); without one the base is
 * the merge-base of HEAD with its upstream (else origin/HEAD, else HEAD). A repository outside git has no base.
 */
export function resolveSliceBase(repository,base=null){
  const top=git(repository,['rev-parse','--show-toplevel']);
  if(top.error||top.status!==0)return {ok:false,code:'SLICE_NOT_GIT',explicit:Boolean(base),reason:`${clean(repository)} is not inside a git checkout, so the slice's base cannot be read`};
  const prefix=clean(git(repository,['rev-parse','--show-prefix']).stdout.trim());
  const commitOf=ref=>{const r=git(repository,['rev-parse','--verify','--quiet',`${ref}^{commit}`]);return r.status===0?r.stdout.trim():null;};
  const context={gitRoot:path.resolve(top.stdout.trim()),prefix};
  if(base){const commit=commitOf(base);return commit?{ok:true,base,baseCommit:commit,source:'argument',...context}:{ok:false,code:'SLICE_BASE_UNKNOWN',explicit:true,reason:`the slice base ${base} is not a commit in ${clean(repository)}`};}
  for(const ref of ['@{upstream}','origin/HEAD']){
    if(!commitOf(ref))continue;const merged=git(repository,['merge-base','HEAD',ref]);
    if(merged.status===0&&merged.stdout.trim())return {ok:true,base:`merge-base HEAD ${ref}`,baseCommit:merged.stdout.trim(),source:'merge-base',...context};
  }
  const head=commitOf('HEAD');
  return head?{ok:true,base:'HEAD',baseCommit:head,source:'head',...context}:{ok:false,code:'SLICE_BASE_UNKNOWN',explicit:false,reason:`${clean(repository)} has no commit to judge the slice against`};
}

/** What the slice changed in its files: {file: {added, ranges}} between the base commit and the working tree. */
export function sliceChanges(repository,resolved,files){
  const atBase=new Set(),changes=new Map();
  const listed=git(repository,['ls-tree','-r','--name-only',resolved.baseCommit,'--',...files]);
  if(listed.status!==0)return {ok:false,reason:`git ls-tree ${resolved.baseCommit} failed: ${firstLine(listed.stderr)}`};
  for(const file of listed.stdout.split(/\r?\n/).filter(Boolean))atBase.add(clean(file));
  const diff=git(repository,['diff','--no-color','--no-ext-diff','--no-textconv','-U0','--relative','--src-prefix=a/','--dst-prefix=b/',resolved.baseCommit,'--',...files]);
  if(diff.status!==0)return {ok:false,reason:`git diff ${resolved.baseCommit} failed: ${firstLine(diff.stderr)}`};
  const ranges=diffRanges(diff.stdout);
  for(const file of files){
    if(!atBase.has(file)){let lines=0;try{const body=fs.readFileSync(path.join(repository,file),'utf8');lines=body.split(/\r?\n/).length-(body.endsWith('\n')?1:0);}catch{}changes.set(file,{added:true,ranges:lines>0?[[1,lines]]:[]});continue;}
    if(ranges.has(file))changes.set(file,{added:false,ranges:ranges.get(file)});
  }
  return {ok:true,atBase:[...atBase].sort(),changes};
}

const HEAVY=new Set(['node_modules','.git','.next','.turbo','.nuxt','.svelte-kit','.cache','.parcel-cache','.vercel','.output','.starciwork','dist','build','out','coverage','storybook-static','tmp','temp']);
const SOURCE_LIKE=/\.(?:[cm]?[jt]sx?|json)$/i,SECRET_LIKE=/(?:^|\/)\.env|secret|credential|token|\.pem$|\.key$/i;
const MAX_IGNORED_BYTES=64*1024*1024;
const linkType=process.platform==='win32'?'junction':'dir';

/** Remove a directory link without ever touching what it points at; true when the link is gone. */
export function removeLink(link){
  let stat;try{stat=fs.lstatSync(link);}catch(error){return error?.code==='ENOENT';}
  if(!stat.isSymbolicLink())return false;
  try{fs.unlinkSync(link);}catch{try{fs.rmdirSync(link);}catch{return false;}}
  try{fs.lstatSync(link);return false;}catch(error){return error?.code==='ENOENT';}
}

/**
 * The base tree: a temporary copy of the repository's working tree (tracked and unignored files, plus ignored
 * source-like files outside build/dependency folders and never an env or secret file) with each slice file put
 * back to its base blob (checkout filters applied) or removed when it did not exist at base. Every node_modules
 * between the repository and its git root, and every nested one, is mirrored as a real folder of per-entry links,
 * never copied, so the target's own ESLint, TypeScript and canon kit resolve exactly as in the working tree, while
 * a workspace package link (pnpm/npm workspaces: @scope/ui -> packages/ui) points at the base tree's copy, not the
 * live repository. dispose() unlinks every link first and deletes the copy only when each link is gone.
 */
export function materializeBaseTree(repository,resolved,{files,atBase}){
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'starci-scoped-lint-base-')),links=[];
  const relativeToGit=clean(path.relative(resolved.gitRoot,repository)),mirrorGit=path.join(temp,path.basename(resolved.gitRoot)||'repository'),root=relativeToGit?path.join(mirrorGit,relativeToGit):mirrorGit;
  const dispose=()=>{const stuck=links.filter(link=>!removeLink(link));if(stuck.length)return {ok:false,temp,stuck};fs.rmSync(temp,{recursive:true,force:true});return {ok:true};};
  try{
    fs.mkdirSync(root,{recursive:true});
    const copy=relative=>{const source=path.join(repository,relative),target=path.join(root,relative);let stat;try{stat=fs.lstatSync(source);}catch{return 0;}if(!stat.isFile())return 0;fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);return stat.size;};
    const listed=git(repository,['ls-files','-z','--cached','--others','--exclude-standard']);
    if(listed.status!==0)throw Error(`git ls-files failed: ${firstLine(listed.stderr)}`);
    for(const relative of new Set(listed.stdout.split('\0').filter(Boolean).map(clean)))if(!relative.split('/').some(part=>part==='node_modules'))copy(relative);
    // Ignored inputs the program may read (next-env.d.ts, generated types): source-like, small, never secrets.
    const ignored=git(repository,['ls-files','-z','--others','--ignored','--exclude-standard','--directory']);let budget=MAX_IGNORED_BYTES;const nested=[];
    const takeIgnored=relative=>{if(budget<=0||!SOURCE_LIKE.test(relative)||SECRET_LIKE.test(relative))return;budget-=copy(relative);};
    const walkIgnored=relative=>{let entries;try{entries=fs.readdirSync(path.join(repository,relative),{withFileTypes:true});}catch{return;}for(const entry of entries){const child=`${relative}/${entry.name}`;if(entry.isSymbolicLink())continue;if(entry.isDirectory()){if(entry.name==='node_modules')nested.push(child);else if(!HEAVY.has(entry.name))walkIgnored(child);}else if(entry.isFile())takeIgnored(child);}};
    for(const entry of ignored.status===0?ignored.stdout.split('\0').filter(Boolean).map(clean):[]){
      const relative=entry.replace(/\/$/,''),parts=relative.split('/');
      if(parts.includes('node_modules')){const at=parts.indexOf('node_modules');nested.push(parts.slice(0,at+1).join('/'));continue;}
      if(parts.some(part=>HEAVY.has(part)))continue;
      if(entry.endsWith('/'))walkIgnored(relative);else takeIgnored(relative);
    }
    // The slice's files as they were at base.
    const inBase=new Set(atBase);
    for(const file of files){
      const target=path.join(root,file);
      if(!inBase.has(file)){fs.rmSync(target,{force:true});continue;}
      const blob=git(repository,['cat-file','--filters',`${resolved.baseCommit}:${resolved.prefix}${file}`],{buffer:true});
      if(blob.status!==0)throw Error(`git cat-file ${resolved.baseCommit}:${resolved.prefix}${file} failed: ${firstLine(blob.stderr)}`);
      fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,blob.stdout);
    }
    // Dependencies resolve through per-entry links: every node_modules from the repository up to its git root, and nested ones.
    const realRepository=fs.realpathSync(repository);
    const remap=real=>{const relative=path.relative(realRepository,real);return relative&&!relative.startsWith('..')&&!path.isAbsolute(relative)&&!relative.split(path.sep).includes('node_modules')?path.join(root,relative):real;};
    const linkEntry=(from,to)=>{let real,stat;try{real=fs.realpathSync(from);stat=fs.statSync(real);}catch{return;}if(fs.existsSync(to))return;
      if(stat.isDirectory()){fs.symlinkSync(remap(real),to,linkType);links.push(to);}else if(stat.isFile())fs.copyFileSync(real,to);};
    const mirror=(source,target)=>{if(!fs.existsSync(source)||fs.existsSync(target))return;fs.mkdirSync(target,{recursive:true});
      for(const entry of fs.readdirSync(source,{withFileTypes:true})){const from=path.join(source,entry.name),to=path.join(target,entry.name);
        if(entry.name.startsWith('@')&&entry.isDirectory()){fs.mkdirSync(to,{recursive:true});for(const scoped of fs.readdirSync(from))linkEntry(path.join(from,scoped),path.join(to,scoped));}else linkEntry(from,to);}};
    for(let cursor=repository;;cursor=path.dirname(cursor)){
      const relative=clean(path.relative(resolved.gitRoot,cursor));if(relative==='..'||relative.startsWith('../')||path.isAbsolute(relative))break;
      mirror(path.join(cursor,'node_modules'),path.join(mirrorGit,relative,'node_modules'));
      if(!relative||path.dirname(cursor)===cursor)break;
    }
    for(const relative of [...new Set(nested)].sort())if(relative!=='node_modules')mirror(path.join(repository,relative),path.join(root,relative));
    return {root,temp,links:[...links],dispose};
  }catch(error){dispose();throw error;}
}

/**
 * Split the slice's located findings into NEW (gating) and PRE-EXISTING (notes). baseIssues null means no base
 * measurement: a finding is then new unless it sits on an unchanged line of a file that existed at base
 * (method changed-lines), or every finding is new when there are no changes known either (method none).
 */
export function classifySliceFindings(issues,{changes=null,baseIssues=null}={}){
  const count=list=>{const counts=new Map();for(const issue of list)if(isLocatedFinding(issue)){const key=findingKey(issue);counts.set(key,(counts.get(key)??0)+1);}return counts;};
  const lineOf=issue=>Number.isInteger(issue.line)?issue.line:null;
  const touched=issue=>{const change=changes?.get(fileOf(issue)),line=lineOf(issue);return Boolean(change?.added||(change&&line!==null&&inRanges(change.ranges,line)));};
  // Occurrences on untouched lines per key: more of them than at base means the slice made that key worse there.
  const base=baseIssues?count(baseIssues):null,untouched=count(issues.filter(issue=>!touched(issue))),fresh=[],preexisting=[],other=[];
  for(const issue of issues){
    if(!isLocatedFinding(issue)){other.push(issue);continue;}
    if(!changes){fresh.push({...issue,newBecause:'no-baseline'});continue;}
    const change=changes.get(fileOf(issue)),line=lineOf(issue),key=findingKey(issue);
    if(change?.added){fresh.push({...issue,newBecause:'added-file'});continue;}
    if(touched(issue)){fresh.push({...issue,newBecause:'changed-line'});continue;}
    if(base){const before=base.get(key)??0;if(before===0){fresh.push({...issue,newBecause:'absent-at-base'});continue;}if(untouched.get(key)>before){fresh.push({...issue,newBecause:'more-than-base',baseCount:before,count:untouched.get(key)});continue;}preexisting.push(issue);continue;}
    if(change&&line===null){fresh.push({...issue,newBecause:'changed-file-unlocated'});continue;}
    preexisting.push(issue);
  }
  return {fresh,preexisting,other};
}

/** One note per (finding code, obligation, rule, file) with the pre-existing count and lines. */
export function preexistingNotes(preexisting,{base}){
  const groups=new Map();
  for(const issue of preexisting){const key=canonicalJSON([issue.code,issue.obligation??null,issue.ruleId??null,fileOf(issue)]);const group=groups.get(key)??{finding:issue.code,obligation:issue.obligation??null,ruleId:issue.ruleId??null,file:fileOf(issue),count:0,lines:new Set()};group.count+=1;if(Number.isInteger(issue.line))group.lines.add(issue.line);groups.set(key,group);}
  return [...groups.values()].sort((a,b)=>a.file.localeCompare(b.file)||String(a.ruleId).localeCompare(String(b.ruleId))||a.finding.localeCompare(b.finding)).map(group=>({code:'SLICE_PREEXISTING_FINDINGS',severity:'note',owner:'code.refactor',finding:group.finding,...(group.obligation?{obligation:group.obligation}:{}),ruleId:group.ruleId,file:group.file,count:group.count,lines:[...group.lines].sort((a,b)=>a-b),
    message:`${group.count} pre-existing ${group.ruleId??group.finding} finding(s) in ${group.file} were already there at ${base} on lines this slice did not change: repository debt owed to code.refactor (review.verify's --all run measures it), never a finding against this slice.`}));
}

/**
 * Judge a slice verdict against its base. measure(root, files) runs the same checks on another tree (a scoped
 * measurement without a baseline of its own) and returns its report. Returns {issues, preexisting, counts,
 * baseline} for check-scoped-lint to seal: issues are the gating ones (run-level issues plus NEW findings).
 */
export async function judgeSliceBaseline(slice,{repository,base=null,measure,skip=null}){
  const located=slice.issues.filter(isLocatedFinding),runLevel=slice.issues.length-located.length;
  const done=(fresh,other,preexisting,baseline)=>({issues:[...other,...fresh],preexisting:preexistingNotes(preexisting,{base:baseline.base??'base'}),counts:{new:fresh.length,preexisting:preexisting.length,runLevel},baseline});
  const resolved=resolveSliceBase(repository,base);
  if(!resolved.ok){
    if(resolved.explicit)return {...done(located.map(issue=>({...issue,newBecause:'no-baseline'})),[...slice.issues.filter(issue=>!isLocatedFinding(issue)),{code:'SLICE_BASE_UNKNOWN',base,message:resolved.reason}],[],{base,method:'none',status:'unavailable',reason:resolved.reason}),counts:{new:located.length,preexisting:0,runLevel:runLevel+1}};
    const {fresh,other,preexisting}=classifySliceFindings(slice.issues);
    return done(fresh,other,preexisting,{base:null,method:'none',status:'unavailable',reason:`${resolved.reason}; every finding on the slice's files gates it - pass --base <the commit before this slice's first edit>`});
  }
  const identity={base:resolved.base,baseCommit:resolved.baseCommit,source:resolved.source};
  const changed=sliceChanges(repository,resolved,slice.files);
  if(!changed.ok){const {fresh,other,preexisting}=classifySliceFindings(slice.issues);return done(fresh,other,preexisting,{...identity,method:'none',status:'unavailable',reason:changed.reason});}
  const changedFiles=[...changed.changes].sort(([a],[b])=>a.localeCompare(b)).map(([file,change])=>({path:file,added:change.added,ranges:change.ranges}));
  const judged=(baseIssues,extra)=>{const {fresh,other,preexisting}=classifySliceFindings(slice.issues,{changes:changed.changes,baseIssues});return done(fresh,other,preexisting,{...identity,changedFiles,...extra});};
  if(!located.length)return judged([],{method:'no-findings',status:'not-needed'});
  // Unchanged slice files: the base tree would equal the working tree, so the base measurement is the current one.
  if(!changed.changes.size)return judged(slice.issues,{method:'unchanged',status:'not-needed'});
  if(skip)return judged(null,{method:'changed-lines',status:'skipped',reason:skip});
  // Every located finding sits in an added file or on a changed line: all are new whatever the base holds.
  const onChanged=issue=>{const change=changed.changes.get(fileOf(issue));return Boolean(change?.added||(change&&Number.isInteger(issue.line)&&inRanges(change.ranges,issue.line)));};
  if(located.every(onChanged))return judged(null,{method:'changed-lines',status:'not-needed',reason:'every finding is in an added file or on a changed line'});
  const baseFiles=changed.atBase;
  if(!baseFiles.length)return judged([],{method:'base-tree',status:'not-needed',reason:'no slice file existed at base'});
  let tree=null,report=null,failure=null,cleanup=null;
  try{tree=materializeBaseTree(repository,resolved,{files:slice.files,atBase:baseFiles});report=await measure(tree.root,baseFiles);}
  catch(error){failure=String(error?.message??error);}
  finally{if(tree){cleanup=tree.dispose();}}
  const cleanupNote=cleanup&&!cleanup.ok?{cleanup:{ok:false,temp:clean(cleanup.temp),stuck:cleanup.stuck.map(clean)}}:{};
  const baseSlice=report?.slice;
  if(failure||!baseSlice||!Array.isArray(baseSlice.issues))return judged(null,{method:'changed-lines',status:'unavailable',reason:failure??'the base measurement returned no slice',...cleanupNote});
  // A base measurement that was itself unavailable may miss findings, which only makes more of the slice's findings new.
  const baseGaps=baseSlice.status==='unavailable'?{baseUnavailable:[...new Set(baseSlice.issues.filter(issue=>!isLocatedFinding(issue)).map(issue=>String(issue.code)))].sort()}:{};
  return judged(baseSlice.issues,{method:'base-tree',status:baseSlice.status==='unavailable'?'partial':'measured',baseStatus:baseSlice.status,...baseGaps,baseFiles,...cleanupNote});
}
