import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContext, worktreeErrors, changeErrors, installedIdentity, snapshots, resolveCommand, hash, same, proofErrors } from './validate.mjs';
import { git } from '../library-source-apply/validate.mjs';

export function installInvocation(ctx, phase) {
  if (!['baseline','release'].includes(phase)) throw new Error('install phase must be baseline or release');
  const script = ctx.plan.gates.find((gate) => gate.command.kind === 'npm-script')?.command;
  if (!script) throw new Error('an existing npm gate is required to resolve npm');
  const resolved = resolveCommand(ctx, script);
  const args = phase === 'baseline' ? ['ci'] : ['install', `${ctx.plan.packageName}@${ctx.plan.toVersion}`, '--save-exact'];
  if (phase === 'release') {
    for (const manifest of ctx.plan.manifests) {
      const workspace = path.posix.dirname(manifest);
      if (workspace === '.') args.push('--include-workspace-root');
      else args.push('--workspace', workspace);
    }
  }
  args.push('--ignore-scripts','--no-audit','--no-fund');
  return { exe: resolved.exe, args: [resolved.args[0], ...args], cwd: ctx.checkout };
}

export async function install(branch, phase) {
  const ctx = await loadContext(branch);
  const errors = worktreeErrors(ctx, true);
  if (git(ctx.checkout, ['rev-parse','HEAD']) !== ctx.base) errors.push('installation must precede the delivery commit');
  if (errors.length) throw new Error(errors.join('\n'));
  if (phase === 'release') {
    const before = JSON.parse(readFileSync(path.join(branch,'response/data/proofs/before.json'),'utf8'));
    const proofProblems = proofErrors(ctx,before,'before',{});
    if (proofProblems.length) throw new Error(proofProblems.join('\n'));
    installedIdentity(ctx,'before');
  }
  const files = snapshots(ctx), invocation = installInvocation(ctx,phase);
  const result = spawnSync(invocation.exe,invocation.args,{cwd:invocation.cwd,encoding:'utf8',shell:false,windowsHide:true,maxBuffer:64*1024*1024,timeout:1200000});
  const log = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const directory = path.join(branch,'response/artifacts/install');mkdirSync(directory,{recursive:true});
  writeFileSync(path.join(directory,`${phase}.log`),log);
  writeFileSync(path.join(directory,`${phase}.json`),JSON.stringify({phase,base:ctx.base,planHash:ctx.planHash,cwd:invocation.cwd,argv:invocation.args.slice(1),exitCode:result.status,logHash:hash(log)},null,2)+'\n');
  if(result.error || result.status !== 0) throw new Error(`consumer ${phase} install failed; inspect the session install log`);
  if(phase === 'baseline' && !same(files,snapshots(ctx))) throw new Error('baseline install changed dependency metadata');
  const afterErrors=worktreeErrors(ctx,phase==='baseline');if(phase==='release')afterErrors.push(...changeErrors(ctx));
  if(afterErrors.length)throw new Error(afterErrors.join('\n'));
  installedIdentity(ctx,phase === 'baseline' ? 'before' : 'after');
  return true;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try { if(process.argv.length!==4)throw new Error('usage: node install.mjs <branch> <baseline|release>');await install(path.resolve(process.argv[2]),process.argv[3]);process.stdout.write('consumer installation verified\n'); }
  catch(error){process.stderr.write(error.message+'\n');process.exitCode=1;}
}
