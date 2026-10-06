import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {runCommand} from '../api/process/run-command.mjs';
import {safeRemove} from '../api/fs/safe-remove.mjs';
import { artifactHoldReason } from '../machine/artifact-hold.mjs';
import {safeRemoveWorktree,createScratchWorktree} from '../machine/worktree-git.mjs';
import { markRemoved } from '../machine/worktree-registry.mjs';
import {posixPath,slash} from '../lib/path-key.mjs';

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
const VERIFY_PROOF='starci/verify-proof@1';
/** The proof of a sealed candidate: planned only from a verifier-owned oracle manifest. */
const CANDIDATE_PROOF='starci/verify-proof@1';
/** What a proof is worth per operation kind. `fail-before` demands the contrast; `checks-only` accepts the re-run. */
export const PROOF_POLICY={'backend.implement':'fail-before','interface.implement':'fail-before',default:'checks-only'};
/** A spec/test file in any of the suites this runtime drives (unit, e2e). */
const SPEC_PATTERN=/\.(spec|test|e2e-spec)\.[cm]?[jt]sx?$/;
const PROOF_TIMEOUT_MS=20*60*1000;
export const VERDICTS=['proven','weak','contradiction','checks-only'];

const unique=list=>[...new Set(list)];
const normalize=value=>posixPath(value).replace(/^\/+/,'');
const tail=(text,max=400)=>String(text??'').trimEnd().slice(-max);
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
  let root=pattern;
  if(root.endsWith('*')){
    while(root.endsWith('*'))root=root.slice(0,-1);
    if(root.endsWith('/'))root=root.slice(0,-1);
  }
  while(root.endsWith('/'))root=root.slice(0,-1);
  if(root&&!root.includes('*')&&(spec===root||spec.startsWith(`${root}/`)))return true;
  const expression=pattern.replace(/[.+^${}()|[\]\\]/g,String.raw`\$&`).replaceAll('**','\u0000').replaceAll('*','[^/]*').replaceAll('\u0000','.*');
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
  const named=specs.map(spec=>`\`${spec}\``).join(', ');
  let reason=null;
  if(!specs.length)reason='the operation changed no spec file, so there is nothing to contrast';
  else if(policy!=='fail-before')reason=`the policy for ${op?.kind??'this kind'} is ${policy}`;
  else if(!commands.length)reason=`no declared check runs the changed spec ${named}`;
  const mode=reason?'checks-only':'fail-before';
  return {schema:VERIFY_PROOF,mode,policy,specs,commands,...(reason?{reason}:{})};
}

const runOne=(exec,command,{cwd,timeoutMs})=>{
  const result=exec(command,{cwd,shell:true,encoding:'utf8',windowsHide:true,timeout:timeoutMs,timeoutMs,maxBuffer:64*1024*1024});
  const timedOut=result?.error?.code==='ETIMEDOUT'||(!Number.isInteger(result?.status)&&Boolean(result?.signal));
  return {exitCode:Number.isInteger(result?.status)?result.status:1,
    tail:tail(`${result?.stdout??''}${result?.stderr??''}`||(result?.error?.message??'')),timedOut,
    unavailable:Boolean(result?.error)&&!timedOut};
};

const runAll=(exec,commands,cwd,timeoutMs)=>commands.map(entry=>({name:entry.name??entry.command,command:entry.command,...runOne(exec,entry.command,{cwd,timeoutMs})}));

const empty=(mode,baseHead,opHead,commands,reason)=>({schema:VERIFY_PROOF,mode,specs:[],commands,
  base:{head:baseHead??null,results:[]},head:{head:opHead??null,results:[]},verdict:'checks-only',...(reason?{reason}:{})});

/**
 * Run the proof commands twice: in a throwaway worktree of `baseHead` carrying only the changed specs, then in
 * the operation's own worktree at `opHead`. `proven` needs a discriminating failure at base and a green head;
 * `weak` means the spec passes at base too (a finding, not a hard failure); `contradiction` means the head is red.
 */
export function runAtBase({worktree,baseHead,opHead=null,specs=[],commands=[],git=null,exec=runCommand,
  timeoutMs=PROOF_TIMEOUT_MS,tmpRoot=os.tmpdir()}={}){
  const plan=unique((specs??[]).map(normalize)).filter(Boolean);
  if(!plan.length||!commands.length)
    return empty('checks-only',baseHead,opHead,commands,!plan.length?'no changed spec to contrast':'no check command runs the changed spec');
  if(!worktree||!baseHead)return empty('checks-only',baseHead,opHead,commands,'the proof needs both a worktree and a base head');
  const parent=fs.mkdtempSync(path.join(tmpRoot,'starci-proof-'));
  const scratch=path.join(parent,'base');
  const cleanup=()=>{
    // Never `git worktree remove --force` or a recursive rmSync: a junction a proof command made in the scratch
    // (a dependency link) would be followed into its target. safeRemove never
    // descends into a link; prune drops the registration.
    try{safeRemoveWorktree(scratch,{repo:worktree,git});}catch{/* the temporary worktree is best-effort */}
    try{safeRemove(parent, { hold: artifactHoldReason });}catch{/* nothing to keep */}
    if(!fs.existsSync(scratch))markRemoved(scratch);
  };
  try{
    // The one scratch worktree API (scripts/api/git/worktree-add.mjs): registered for the GC, removed in the finally below.
    const added=createScratchWorktree({repoRoot:worktree,dir:scratch,kind:'land-scratch',detach:true,base:baseHead,git});
    if(!added.ok)
      return {...empty('fail-before',baseHead,opHead,commands,`the base worktree of ${short(baseHead)} could not be created: ${tail(added.detail??added.reason,200)}`),
        specs:plan,verdict:'weak',error:tail(added.detail??added.reason,200)||'git worktree add failed'};
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
    let verdict='weak';
    if(headRed)verdict='contradiction';
    else if(discriminating)verdict='proven';
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
    const first=(result.head?.results??[]).find(item=>item.exitCode!==0);
    const command=first?`\`${first.name}\` exits ${first.exitCode}`:'fails';
    return `the proof command ${command} in the operation worktree at head `+
      `${short(result.head?.head)}: the change contradicts ${named}${first?.timedOut?' (it timed out)':''}`;
  }
  if(result.error)
    return `the base worktree at ${short(result.base?.head)} could not be built (${result.error}), so ${named} is unproven: `+
      `a green check does not show the behavior changed`;
  return specs.length>1
    ?`the added specs ${named} also pass at base ${short(result.base?.head)}: they do not prove the change`
    :`the added spec ${named} also passes at base ${short(result.base?.head)}: it does not prove the change`;
}

/**
 * Build a proof plan exclusively from a pre-sealed, verifier-owned oracle manifest. Tests written in the
 * candidate are supplemental and cannot become the oracle merely because the implementer reported them.
 */
/**
 * Whether the protected proof is a gate for this operation at all. Proof by contrast is a statement about code:
 * a spec the operation added must fail on the code it started from. A kind that writes no code (a record author,
 * a decision, a drawing, a review) has nothing the proof could contrast, and an operation whose checks name no spec
 * file sealed no oracle to contrast with. Both are answered by the re-run checks, the Work validator and the
 * independent validator - the acceptance every operation already passes - and are recorded as skipped, not judged.
 */
export function proofApplies(op,{oracleManifest=null,writes=null}={}){
  const kindWrites=Array.isArray(writes)?writes:[];
  if(!kindWrites.includes('code'))return {applies:false,reason:`the kind ${op?.kind??'operation'} writes no code: the Work validator and the independent validator are its proof`};
  const oracles=Array.isArray(oracleManifest?.oracles)?oracleManifest.oracles:[];
  if(!oracles.length)return {applies:false,reason:'no protected oracle was sealed for this operation (its checks name no spec file): the re-run checks and the independent validator are its proof'};
  return {applies:true,reason:null};
}

export function planProtectedProof(op,{oracleManifest,candidateChanges=[],policy=null}={}){
  const manifest=plainOracleManifest(oracleManifest);
  const changed=new Set(candidateChanges.map(item=>normalize(typeof item==='string'?item:item?.path)).filter(Boolean));
  const errors=[];
  if(!manifest)errors.push('missing or malformed protected oracle manifest');
  const oracles=listOfOracle(manifest?.oracles).filter(oracle=>{
    const valid=typeof oracle.id==='string'&&oracle.id&&typeof oracle.command==='string'&&oracle.command&&
      typeof oracle.sha256==='string'&&/^[a-f0-9]{64}$/.test(oracle.sha256)&&Array.isArray(oracle.assertionIds)&&oracle.assertionIds.length&&
      typeof oracle.ownerAttemptId==='string'&&oracle.ownerAttemptId&&oracle.ownerAttemptId!==op?.id;
    if(!valid)errors.push(`malformed or non-independent oracle ${oracle?.id??'(unknown)'}`);
    if(changed.has(normalize(oracle.path)))errors.push(`candidate changed protected oracle ${oracle.path}`);
    return valid;
  });
  const selected=oracles.filter(oracle=>!Array.isArray(oracle.kinds)||oracle.kinds.includes(op?.kind));
  if(!selected.length)errors.push(`no protected oracle covers ${op?.kind??'operation'}`);
  const mode=policy??(op?.proofPolicy==='equivalence'?'equivalence':'fail-before');
  if(!['fail-before','equivalence'].includes(mode))errors.push(`unsupported proof policy ${mode}`);
  return {schema:CANDIDATE_PROOF,mode,opId:op?.id??null,kind:op?.kind??null,manifestDigest:manifest?.digest??null,
    oracles:selected.map(oracle=>({...oracle,path:normalize(oracle.path)})),errors,ready:errors.length===0};
}

const plainOracleManifest=value=>value&&typeof value==='object'&&!Array.isArray(value)&&value.schema==='starci/oracle-manifest@1'&&
  typeof value.digest==='string'&&/^[a-f0-9]{64}$/.test(value.digest)?value:null;
const listOfOracle=value=>Array.isArray(value)?value.filter(item=>item&&typeof item==='object'&&!Array.isArray(item)):[];
const classifyBase=(result,oracle)=>{
  if(result.timedOut)return {outcome:'inconclusive',reason:'base oracle timed out'};
  if(result.unavailable)return {outcome:'unavailable',reason:result.tail||'base oracle unavailable'};
  if(result.exitCode===0)return {outcome:'fail',reason:'oracle also passes at base'};
  if(!oracle.expectedBaseFailure)return {outcome:'inconclusive',reason:'base failed without a declared expected failure signature'};
  try{return new RegExp(oracle.expectedBaseFailure).test(result.tail)?{outcome:'pass'}:
    {outcome:'inconclusive',reason:'base failed for a different reason than the declared behavior assertion'};}
  catch{return {outcome:'inconclusive',reason:'oracle expectedBaseFailure is not a valid regular expression'};}
};

const equivalenceBase=baseResult=>{
  if(baseResult.exitCode===0)return {outcome:'pass'};
  return {outcome:baseResult.timedOut?'inconclusive':'unavailable',reason:'equivalence baseline did not run cleanly'};
};

const oracleResult=(exec,oracle,{mode,baseRoot,candidateRoot,timeoutMs})=>{
  const baseResult=runOne(exec,oracle.command,{cwd:baseRoot,timeoutMs});
  const candidateResult=runOne(exec,oracle.command,{cwd:candidateRoot,timeoutMs});
  const baseVerdict=mode==='equivalence'?equivalenceBase(baseResult):classifyBase(baseResult,oracle);
  let outcome;
  if(candidateResult.timedOut)outcome='inconclusive';
  else if(candidateResult.exitCode!==0)outcome='fail';
  else outcome=baseVerdict.outcome;
  const reason=candidateResult.exitCode!==0?'candidate oracle failed':baseVerdict.reason??null;
  return {oracleId:oracle.id,assertionIds:oracle.assertionIds,base:baseResult,candidate:candidateResult,outcome,reason};
};

/** Run protected commands against immutable base/candidate roots. Only a discriminating, candidate-green result passes. */
export function runProtectedProof({plan,baseRoot,candidateRoot,oracleRoot,exec=runCommand,timeoutMs=PROOF_TIMEOUT_MS}={}){
  if(plan?.schema!==CANDIDATE_PROOF||!plan.ready)return {schema:CANDIDATE_PROOF,verdict:'inconclusive',results:[],errors:plan?.errors??['proof plan is not ready']};
  if(!baseRoot||!candidateRoot||!oracleRoot)return {schema:CANDIDATE_PROOF,verdict:'unavailable',results:[],errors:['proof roots are unavailable']};
  const results=plan.oracles.map(oracle=>oracleResult(exec,oracle,{mode:plan.mode,baseRoot,candidateRoot,timeoutMs}));
  const order=['fail','inconclusive','unavailable'];
  const verdict=order.find(value=>results.some(result=>result.outcome===value))??'pass';
  return {schema:CANDIDATE_PROOF,mode:plan.mode,manifestDigest:plan.manifestDigest,verdict,results};
}

export function protectedProofFinding(result){
  if(result?.verdict==='pass')return null;
  const first=(result?.results??[]).find(item=>item.outcome!=='pass');
  return first?`protected oracle ${first.oracleId} is ${first.outcome}: ${first.reason??'no conclusive proof'}`:
    `protected proof is ${result?.verdict??'inconclusive'}: ${(result?.errors??[]).join('; ')}`;
}
