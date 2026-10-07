import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isProductPath, agentDataCategory} from '../../lib/starciwork-boundary.mjs';
import {lsFiles} from '../../api/git/ls-files.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..','..');
const BOUNDARY_TRANSITIONAL=Object.freeze([]);
const DENIED_SEGMENTS=/^(evidence|runs|draw-loop|operations|assets|kernel-evidence|kernel-strays|kernel-approvals|worktrees|settle-parity|settle-tail|runtime|canon-seams)$/;

function trackedFilesUnder(dir){
  const result=lsFiles(['-z','--','.'],{cwd:dir,maxBuffer:256*1024*1024});
  if(result.error||result.status!==0)return [];
  return result.stdout.split('\0').filter(Boolean).map(rel=>path.join(dir,rel));
}

function boundaryGroupKey(category,parts){
  const at=category?parts.findIndex((segment,index)=>index<parts.length-1&&DENIED_SEGMENTS.test(segment)):-1;
  const cut=at<0?parts.length:at+1+Number(['runs','operations','evidence'].includes(parts[at]));
  return `${category??'drift'}|${parts.slice(0,Math.min(cut,parts.length)).join('/')}`;
}

function reportBoundaryGroup(key,count,resolveRoot,problems,warnings){
  const [category,where]=key.split('|');
  const shown=path.relative(root,path.join(resolveRoot,where)).replaceAll('\\','/');
  const files=count>1?` (${count} files)`:'';
  if(category==='drift'){
    warnings.push(`${shown}${files}: not on the .starciwork product path list (work-layout.yaml shape.productPaths) - a record in a retired layout or a stray file [STARCIWORK_DRIFT]`);
  }else if(BOUNDARY_TRANSITIONAL.includes(category)){
    warnings.push(`${shown}${files}: ${category} is agent data still written in place; it moves to blobs + job_artifacts [HFS_AGENT_DATA_TRACKED]`);
  }else{
    problems.push(`${shown}${files}: ${category} is agent data, not product content - it belongs in the project ledger and the blob store (starci kernel report --attach from STARCI_JOB_SCRATCH), cited by artifact id + sha256 [HFS_AGENT_DATA_TRACKED]`);
  }
}

/** Judge tracked paths in one .starciwork tree against its declared product path boundary. */
export function checkStarciworkBoundary(workRoot,problems,warnings=[],resolveRoot=workRoot){
  const groups=new Map();
  for(const file of trackedFilesUnder(workRoot)){
    const rel=path.relative(resolveRoot,file).replaceAll('\\','/');
    if(!rel||rel.startsWith('../')||isProductPath(rel))continue;
    const category=agentDataCategory(rel);
    const parts=rel.split('/');
    const key=boundaryGroupKey(category,parts);
    groups.set(key,(groups.get(key)??0)+1);
  }
  for(const [key,count] of groups)reportBoundaryGroup(key,count,resolveRoot,problems,warnings);
}
