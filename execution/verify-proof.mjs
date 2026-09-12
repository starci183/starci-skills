import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

/**
 * Proof by contrast for machine verification. `machineVerify` re-runs the checks an operation declares,
 * so it proves the checks pass - not that the behavior changed: an operation can write a spec that would
 * pass against the old code and still report green. This module runs the operation's OWN new spec against
 * the code it replaces. A base worktree of `baseHead` is created, only the changed spec files are copied
 * into it, and the proof commands run there: the spec must FAIL before the change and pass after it.
 *
 * The op worktree is never modified, never committed to and never checked out - the base lives in a
 * temporary linked worktree that is removed in a `finally`.
 */
export const VERIFY_PROOF='starci/verify-proof@1';
/** What a proof is worth per operation kind. `fail-before` demands the contrast; `checks-only` accepts the re-run. */
export const PROOF_POLICY={'backend.implement':'fail-before','interface.implement':'fail-before',default:'checks-only'};
/** A spec/test file in any of the suites this runtime drives (unit, e2e, container). */
export const SPEC_PATTERN=/\.(spec|test|e2e-spec|container-spec)\.[cm]?[jt]sx?$/;
export const PROOF_TIMEOUT_MS=20*60*1000;
export const VERDICTS=['proven','weak','contradiction','checks-only'];

const unique=list=>[...new Set(list)];
const slash=value=>String(value??'').replaceAll('\\','/');
const normalize=value=>slash(value).replace(/^\.\//,'').replace(/^\/+/,'');
const tail=(text,max=400)=>String(text??'').replace(/\s+$/,'').slice(-max);
const native=file=>path.join(...normalize(file).split('/'));
const base=file=>normalize(file).split('/').at(-1);
const short=head=>String(head??'').slice(0,12)||'(unknown)';
const listOf=value=>(Array.isArray(value)?value:[value]).filter(item=>typeof item==='string'&&item.trim()).map(item=>item.trim());

export const isSpecPath=file=>SPEC_PATTERN.test(normalize(file));
export const policyFor=kind=>PROOF_POLICY[kind]??PROOF_POLICY.default;

/** A check `scope` is a path, a directory or a glob (`src/**`, `*.spec.ts`); it covers a spec by prefix or by pattern. */
function scopeCovers(entry,spec){
  const pattern=normalize(entry);
  if(!pattern)return false;
  const root=pattern.replace(/\/?\*+$/,'').replace(/\/+$/,'');
  if(root&&!root.includes('*')&&(spec===root||spec.startsWith(`${root}/`)))return true;
  const expression=pattern.replace(/[.+^${}()|[\]\\]/g,'\\$&').replaceAll('**','\u0000').replaceAll('*','[^/]*').replaceAll('\u0000','.*');
  try{return new RegExp(`^${expression}$`).test(spec);}catch{return false;}
}

/** Does this check actually run one of the changed specs? By path substring, by file name, or by its declared scope. */
function runsSpec(check,specs){
  const command=normalize(check?.command);
  const scopes=listOf(check?.scope);
  return specs.some(spec=>command.includes(spec)||command.includes(base(spec))||scopes.some(entry=>scopeCovers(entry,spec)));
}

/**
 * The proof plan of one operation: the spec files it added or changed, and the check commands that run them.
 * `mode` is `fail-before` only when the kind's policy asks for the contrast AND there is a spec with a command
 * that runs it; otherwise `checks-only` with the reason, so a downgrade is never silent.
 */
export function proofPlan(op,{changedFiles=[]}={}){
  const policy=policyFor(op?.kind);
  const specs=unique((changedFiles??[]).map(normalize).filter(isSpecPath));
  const commands=specs.length
    ?(op?.checks??[]).filter(check=>check?.command&&runsSpec(check,specs)).map(check=>({name:check.name??check.command,command:check.command}))
    :[];
  const reason=!specs.length?'the operation changed no spec file, so there is nothing to contrast'
    :policy!=='fail-before'?`the policy for ${op?.kind??'this kind'} is ${policy}`
      :!commands.length?`no declared check runs the changed spec ${specs.map(spec=>`\`${spec}\``).join(', ')}`
        :null;
  const mode=reason?'checks-only':'fail-before';
  return {schema:VERIFY_PROOF,mode,policy,specs,commands,...(reason?{reason}:{})};
}

const runOne=(exec,command,{cwd,timeoutMs})=>{
  const result=exec(command,{cwd,shell:true,encoding:'utf8',windowsHide:true,timeout:timeoutMs,timeoutMs,maxBuffer:64*1024*1024});
  const timedOut=result?.error?.code==='ETIMEDOUT'||(!Number.isInteger(result?.status)&&Boolean(result?.signal));
  return {exitCode:Number.isInteger(result?.status)?result.status:1,
    tail:tail(`${result?.stdout??''}${result?.stderr??''}`||(result?.error?.message??'')),timedOut};
};

const runAll=(exec,commands,cwd,timeoutMs)=>commands.map(entry=>({name:entry.name??entry.command,command:entry.command,...runOne(exec,entry.command,{cwd,timeoutMs})}));

const empty=(mode,baseHead,opHead,commands,reason)=>({schema:VERIFY_PROOF,mode,specs:[],commands,
  base:{head:baseHead??null,results:[]},head:{head:opHead??null,results:[]},verdict:'checks-only',...(reason?{reason}:{})});

/**
 * Run the proof commands twice: in a throwaway worktree of `baseHead` carrying only the changed specs, then in
 * the operation's own worktree at `opHead`. `proven` needs a discriminating failure at base and a green head;
 * `weak` means the spec passes at base too (a finding, not a hard failure); `contradiction` means the head is red.
 */
export function runAtBase({worktree,baseHead,opHead=null,specs=[],commands=[],git=spawnSync,exec=spawnSync,
  timeoutMs=PROOF_TIMEOUT_MS,tmpRoot=os.tmpdir()}={}){
  const plan=unique((specs??[]).map(normalize)).filter(Boolean);
  if(!plan.length||!commands.length)
    return empty('checks-only',baseHead,opHead,commands,!plan.length?'no changed spec to contrast':'no check command runs the changed spec');
  if(!worktree||!baseHead)return empty('checks-only',baseHead,opHead,commands,'the proof needs both a worktree and a base head');
  const run=args=>git('git',args,{cwd:worktree,encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024});
  const parent=fs.mkdtempSync(path.join(tmpRoot,'starci-proof-'));
  const scratch=path.join(parent,'base');
  const cleanup=()=>{
    try{run(['worktree','remove','--force',scratch]);}catch{/* the temporary worktree is best-effort */}
    try{fs.rmSync(parent,{recursive:true,force:true});}catch{/* nothing to keep */}
    try{run(['worktree','prune']);}catch{/* nothing to keep */}
  };
  try{
    const added=run(['worktree','add','--detach',scratch,baseHead]);
    if(added?.status!==0)
      return {...empty('fail-before',baseHead,opHead,commands,`the base worktree of ${short(baseHead)} could not be created: ${tail(added?.stderr,200)}`),
        specs:plan,verdict:'weak',error:tail(added?.stderr,200)||'git worktree add failed'};
    const copied=[],missing=[];
    for(const spec of plan){
      const source=path.join(worktree,native(spec)),target=path.join(scratch,native(spec));
      if(!fs.existsSync(source)){missing.push(spec);continue;}
      fs.mkdirSync(path.dirname(target),{recursive:true});
      fs.copyFileSync(source,target);
      copied.push(spec);
    }
    const baseResults=runAll(exec,commands,scratch,timeoutMs);
    const headResults=runAll(exec,commands,worktree,timeoutMs);
    const headRed=headResults.some(result=>result.exitCode!==0);
    const discriminating=baseResults.some(result=>result.exitCode!==0&&!result.timedOut);
    const verdict=headRed?'contradiction':discriminating?'proven':'weak';
    const stalled=baseResults.some(result=>result.timedOut);
    return {schema:VERIFY_PROOF,mode:'fail-before',specs:plan,commands,copied,missing,
      base:{head:baseHead,worktree:slash(scratch),results:baseResults},
      head:{head:opHead??null,worktree:slash(worktree),results:headResults},verdict,
      ...(verdict==='weak'&&stalled?{reason:'every proof command timed out at base, so the contrast is unknown'}:{})};
  }finally{cleanup();}
}

/** The sentence the kernel puts in `open[]`/findings. `proven` and `checks-only` say nothing. */
export function proofFinding(result){
  if(!result||['proven','checks-only'].includes(result.verdict))return null;
  const specs=(result.specs??[]).map(spec=>`\`${spec}\``);
  const named=specs.length?specs.join(', '):'the operation spec';
  if(result.verdict==='contradiction'){
    const failed=(result.head?.results??[]).filter(item=>item.exitCode!==0);
    const first=failed[0];
    return `the proof command ${first?`\`${first.name}\` exits ${first.exitCode}`:'fails'} in the operation worktree at head `+
      `${short(result.head?.head)}: the change contradicts ${named}${first?.timedOut?' (it timed out)':''}`;
  }
  if(result.error)
    return `the base worktree at ${short(result.base?.head)} could not be built (${result.error}), so ${named} is unproven: `+
      `a green check does not show the behavior changed`;
  return specs.length>1
    ?`the added specs ${named} also pass at base ${short(result.base?.head)}: they do not prove the change`
    :`the added spec ${named} also passes at base ${short(result.base?.head)}: it does not prove the change`;
}
