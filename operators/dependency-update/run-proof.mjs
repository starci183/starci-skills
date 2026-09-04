import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContext, worktreeErrors, changeErrors, installedIdentity, snapshots, resolveCommand, hash, same, regressionFailed, proofEnvironment } from './validate.mjs';
import { git } from '../library-source-apply/validate.mjs';
export async function runProof(branch,phase){
  const ctx=await loadContext(branch),command=['before','after'].includes(phase)?ctx.plan.regression.command:ctx.plan.gates.find((g)=>g.id===phase)?.command;
  if(!command)throw new Error('unknown declared proof phase');
  const errors=worktreeErrors(ctx,phase==='before');if(git(ctx.checkout,['rev-parse','HEAD'])!==ctx.base)errors.push('proofs run before the delivery commit');if(phase!=='before')errors.push(...changeErrors(ctx));if(errors.length)throw new Error(errors.join('\n'));
  const installed=installedIdentity(ctx,phase),files=snapshots(ctx),regressionHash=hash(readFileSync(path.join(ctx.checkout,ctx.plan.regression.file))),resolved=resolveCommand(ctx,command),startedAt=new Date().toISOString();
  const environment=proofEnvironment(ctx,command);
  const result=spawnSync(resolved.exe,resolved.args,{cwd:ctx.checkout,env:{...process.env,...environment},encoding:'utf8',shell:false,windowsHide:true,maxBuffer:64*1024*1024,timeout:1200000});
  if(result.error||result.status===null)throw new Error('proof process did not complete');
  if(!same(files,snapshots(ctx))||worktreeErrors(ctx,phase==='before').length)throw new Error('proof command mutated consumer inputs');
  const output=`${result.stdout??''}${result.stderr??''}`,outputRef=`response/artifacts/proofs/${phase}.log`;
  mkdirSync(path.join(branch,'response/artifacts/proofs'),{recursive:true});mkdirSync(path.join(branch,'response/data/proofs'),{recursive:true});writeFileSync(path.join(branch,outputRef),output);
  const proof={phase,base:ctx.base,planHash:ctx.planHash,command,commandHash:resolved.commandHash,environment,files,regressionHash,installed,exitCode:result.status,outputRef,outputHash:hash(output),startedAt,finishedAt:new Date().toISOString()};writeFileSync(path.join(branch,`response/data/proofs/${phase}.json`),JSON.stringify(proof,null,2)+'\n');
  const passed=phase==='before'?result.status>0&&regressionFailed(output,ctx.plan.regression.assertion):result.status===0;process.stdout.write(`${phase}: exit ${result.status}, expected outcome ${passed?'proved':'not proved'}\n`);return passed;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{if(!process.argv[2]||!process.argv[3])throw new Error('usage: node run-proof.mjs <branch> <phase>');if(!await runProof(path.resolve(process.argv[2]),process.argv[3]))process.exitCode=1;}catch(error){process.stderr.write(error.message+'\n');process.exitCode=1;}}
