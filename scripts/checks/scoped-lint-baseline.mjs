// The slice's own NEW findings (nivo auth inc-ee60a7c362a7; the Sonar slice rule 3e0b17f9c's principle).
//
// A scoped check-scoped-lint run over a slice's files used to gate on EVERY finding in each file the slice
// touched, including repository debt the slice never wrote (modules/auth/session.tsx useSession, a
// hook-location finding with ~20 importers: fixing it is a repo-wide refactor), so a slice touching an old
// file could never pass. The slice is now judged against its base (--base, default the merge-base of HEAD
// with its upstream): the same checks run on a base tree - the current working tree with the slice's files
// put back to their base blobs, plain files only and never a link (nivo-fe inc-c8fbf76aa499), measured in a child
// process whose dependencies read the live node_modules through scoped-lint-base-view.mjs - and a located finding
// gates the slice only when it is NEW:
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
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {canonicalJSON} from '../../engine/index.mjs';
import {isLinkLike,safeRemoveTree} from '../lib/safe-remove.mjs';
import {BASE_VIEW_ENV} from './scoped-lint-base-view.mjs';

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
export const BASE_MEASURE_TIMEOUT_MS=30*60*1000;
const VIEW_FILE=fileURLToPath(new URL('./scoped-lint-base-view.mjs',import.meta.url));
const MEASURE_FILE=fileURLToPath(new URL('./scoped-lint-base-measure.mjs',import.meta.url));

/** Every link (symlink, junction, other reparse point) under root, found with lstat; the walk never enters one. */
export function linksUnder(root){
  const found=[];
  const visit=(p,parentReal)=>{let stat;try{stat=fs.lstatSync(p);}catch{return;}
    if(isLinkLike(p,{parentReal,stat})){found.push(p);return;}if(!stat.isDirectory())return;
    let real,names;try{real=fs.realpathSync.native(p);names=fs.readdirSync(p);}catch{return;}
    for(const name of names)visit(path.join(p,name),real);};
  visit(path.resolve(root),null);return found;
}

/**
 * The base tree (nivo-fe inc-c8fbf76aa499: LINK-FREE). A temporary copy of the repository's working tree made of plain
 * files and directories only - tracked and unignored files, plus ignored source-like files outside build/dependency
 * folders and never an env or secret file - with each slice file put back to its base blob (checkout filters applied)
 * or removed when it did not exist at base. It holds NO node_modules and NO link of any kind: a link in the working
 * tree is never copied, never entered, and never recreated. The measurement reads dependencies from the live repository
 * through the base view (scoped-lint-base-view.mjs, measureBaseTree). dispose() lists every link found under the temp
 * directory (there must be none) and removes it with safeRemoveTree, which never descends into a link.
 */
export function materializeBaseTree(repository,resolved,{files,atBase}){
  const temp=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'starci-scoped-lint-base-')));
  const relativeToGit=clean(path.relative(resolved.gitRoot,repository)),mirrorGit=path.join(temp,'tree',path.basename(resolved.gitRoot)||'repository'),root=relativeToGit?path.join(mirrorGit,relativeToGit):mirrorGit;
  const dispose=()=>{const links=linksUnder(temp),removed=safeRemoveTree(temp);return {ok:removed.ok,temp,links,errors:removed.errors};};
  try{
    fs.mkdirSync(root,{recursive:true});
    const copy=relative=>{const source=path.join(repository,relative),target=path.join(root,relative);let stat;try{stat=fs.lstatSync(source);}catch{return 0;}if(!stat.isFile())return 0;fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);return stat.size;};
    const listed=git(repository,['ls-files','-z','--cached','--others','--exclude-standard']);
    if(listed.status!==0)throw Error(`git ls-files failed: ${firstLine(listed.stderr)}`);
    for(const relative of new Set(listed.stdout.split('\0').filter(Boolean).map(clean)))if(!relative.split('/').some(part=>part==='node_modules'))copy(relative);
    // Ignored inputs the program may read (next-env.d.ts, generated types): source-like, small, never secrets, never through a link.
    const ignored=git(repository,['ls-files','-z','--others','--ignored','--exclude-standard','--directory']);let budget=MAX_IGNORED_BYTES;
    const takeIgnored=relative=>{if(budget<=0||!SOURCE_LIKE.test(relative)||SECRET_LIKE.test(relative))return;budget-=copy(relative);};
    const walkIgnored=relative=>{const absolute=path.join(repository,relative);if(isLinkLike(absolute))return;let entries;try{entries=fs.readdirSync(absolute,{withFileTypes:true});}catch{return;}
      for(const entry of entries){const child=`${relative}/${entry.name}`;if(entry.isSymbolicLink())continue;if(entry.isDirectory()){if(!HEAVY.has(entry.name))walkIgnored(child);}else if(entry.isFile())takeIgnored(child);}};
    for(const entry of ignored.status===0?ignored.stdout.split('\0').filter(Boolean).map(clean):[]){
      const relative=entry.replace(/\/$/,''),parts=relative.split('/');
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
    return {root,temp,gitRoot:mirrorGit,live:{root:repository,gitRoot:path.resolve(resolved.gitRoot)},dispose};
  }catch(error){dispose();throw error;}
}

/** The node_modules the base tree's dependencies read from: the live repository's, from the repository up to its git root. */
export function liveNodeModules(repository,gitRoot){
  const found=[];
  for(let cursor=path.resolve(repository);;cursor=path.dirname(cursor)){
    const relative=path.relative(path.resolve(gitRoot),cursor);if(relative.startsWith('..')||path.isAbsolute(relative))break;
    const modules=path.join(cursor,'node_modules');if(fs.existsSync(modules))found.push(modules);
    if(!relative||path.dirname(cursor)===cursor)break;
  }
  return found;
}

/** The measuring child's environment: the base view preloaded (for every node grandchild too) and NODE_PATH at the live node_modules. */
export function baseViewEnv(tree,env=process.env){
  const nodePath=[...liveNodeModules(tree.live.root,tree.live.gitRoot),...String(env.NODE_PATH??'').split(path.delimiter)].filter(Boolean);
  const options=[String(env.NODE_OPTIONS??'').trim(),`--import=${pathToFileURL(VIEW_FILE).href}`].filter(Boolean).join(' ');
  return {...env,NODE_PATH:nodePath.join(path.delimiter),NODE_OPTIONS:options,[BASE_VIEW_ENV]:JSON.stringify({base:tree.gitRoot,live:tree.live.gitRoot})};
}

/** A report measured on the base tree, with the base tree's absolute paths written as the live repository's. */
export function rebaseReport(value,tree){
  const pairs=[[tree.gitRoot,tree.live.gitRoot],[tree.gitRoot.replaceAll('\\','/'),tree.live.gitRoot.replaceAll('\\','/')]].filter(([from,to])=>from&&from!==to);
  const map=item=>{if(typeof item==='string'){let text=item;for(const [from,to] of pairs)text=text.split(from).join(to);return text;}if(Array.isArray(item))return item.map(map);if(item&&typeof item==='object')return Object.fromEntries(Object.entries(item).map(([key,entry])=>[key,map(entry)]));return item;};
  return map(value);
}

/**
 * Measure the base tree in a child process with the base view preloaded: the same measure-only check-scoped-lint run,
 * isolated from this process (its own TypeScript project service, its own module hooks and read-only fs view).
 * Resolves to the base report (paths rebased onto the live repository); rejects when the child fails.
 */
export function measureBaseTree(tree,{files,profile,architectureConfig=null,timeoutMs=BASE_MEASURE_TIMEOUT_MS,entry=MEASURE_FILE,env=process.env}={}){
  const request=path.join(tree.temp,'request.json'),out=path.join(tree.temp,'report.json');
  fs.writeFileSync(request,JSON.stringify({root:tree.root,files,profile,architectureConfig,out}));
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[entry,request],{cwd:tree.root,env:baseViewEnv(tree,env),windowsHide:true,stdio:['ignore','ignore','pipe']});
    let stderr='';child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-4000);});
    const timer=setTimeout(()=>{child.kill();},timeoutMs);
    child.on('error',error=>{clearTimeout(timer);reject(error);});
    child.on('close',(code,signal)=>{clearTimeout(timer);
      let report=null;try{report=JSON.parse(fs.readFileSync(out,'utf8'));}catch{report=null;}
      if(code===0&&report&&!report.error)return resolve(rebaseReport(report,tree));
      const last=stderr.trim().split(/\r?\n/).slice(-1)[0]??'';
      reject(Error(`the base measurement ${signal?`was stopped (${signal})`:`exited ${code}`}${report?.error?`: ${report.error}`:''}${last?`: ${last}`:''}`));});
  });
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
export async function judgeSliceBaseline(slice,{repository,base=null,measure,skip=null,materialize=materializeBaseTree}){
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
  // The base tree is link-free (inc-c8fbf76aa499): plain files only, dependencies read through the base view, removed
  // with safeRemoveTree; a link found in it at cleanup makes the measurement unavailable (and is unlinked, never followed).
  let tree=null,report=null,failure=null,cleanup=null;
  try{tree=materialize(repository,resolved,{files:slice.files,atBase:baseFiles});report=await measure(tree.root,baseFiles,tree);}
  catch(error){failure=String(error?.message??error);}
  finally{if(tree){cleanup=tree.dispose();}}
  const linked=cleanup?.links?.length?cleanup.links.map(link=>clean(path.relative(cleanup.temp,link))):[];
  const cleanupNote=cleanup&&(!cleanup.ok||linked.length)?{cleanup:{ok:cleanup.ok,temp:clean(cleanup.temp),links:linked,errors:cleanup.errors.slice(0,5).map(error=>`${error.code} ${clean(error.path)}`)}}:{};
  if(linked.length)return judged(null,{method:'changed-lines',status:'unavailable',reason:`a link appeared in the base tree (${linked.slice(0,3).join(', ')}); the base tree must hold none (nivo-fe inc-c8fbf76aa499), so its measurement is not used`,...cleanupNote});
  const baseSlice=report?.slice;
  if(failure||!baseSlice||!Array.isArray(baseSlice.issues))return judged(null,{method:'changed-lines',status:'unavailable',reason:failure??'the base measurement returned no slice',...cleanupNote});
  // A base measurement that was itself unavailable may miss findings, which only makes more of the slice's findings new.
  const baseGaps=baseSlice.status==='unavailable'?{baseUnavailable:[...new Set(baseSlice.issues.filter(issue=>!isLocatedFinding(issue)).map(issue=>String(issue.code)))].sort()}:{};
  return judged(baseSlice.issues,{method:'base-tree',status:baseSlice.status==='unavailable'?'partial':'measured',baseStatus:baseSlice.status,...baseGaps,baseFiles,...cleanupNote});
}
