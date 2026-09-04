// The consumer installs of library.update: `baseline` reinstalls the lock as committed at the package
// commit and proves the consumer resolves the base version; `release` installs the tarball this run
// packed, saving the exact version into the declared consumer workspaces only, and proves every
// packed file is installed byte for byte. Both derive the cwd from the validated route and use fixed
// npm arguments; a caller-supplied cwd or an ad hoc install command is not accepted.
//   node install.mjs <branch> <baseline|release>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContext, worktreeErrors, consumerChangeErrors, installedIdentity, consumerSnapshots, resolveCommand, hash, same, git, bindPackageCommit, consumerProofErrors, consumerPhase } from './validate.mjs';

export function installInvocation(ctx, phase) {
  if (!['baseline', 'release'].includes(phase)) throw new Error('install phase must be baseline or release');
  const script = ctx.consumer.gates.find((gate) => gate.command.kind === 'npm-script')?.command;
  if (!script) throw new Error('an existing npm gate is required to resolve npm');
  const resolved = resolveCommand(ctx, script, ctx.rootManifest, ctx.checkout);
  const args = phase === 'baseline' ? ['ci'] : ['install', ctx.release.artifact.replace(/^response\//, path.join(ctx.branch, 'response').replaceAll('\\', '/') + '/'), '--save-exact'];
  if (phase === 'release') {
    for (const manifest of ctx.consumer.manifests) {
      const workspace = path.posix.dirname(manifest);
      if (workspace === '.') args.push('--include-workspace-root');
      else args.push('--workspace', workspace);
    }
  }
  args.push('--ignore-scripts', '--no-audit', '--no-fund');
  return { exe: resolved.exe, args: [resolved.args[0], ...args], cwd: ctx.checkout };
}

export async function install(branch, phase) {
  const ctx = await loadContext(branch);
  bindPackageCommit(ctx, JSON.parse(readFileSync(path.join(branch, 'response/data/library.json'), 'utf8')));
  const errors = worktreeErrors(ctx, { phase: 'pristine', head: ctx.packageCommit });
  if (errors.length) throw new Error(errors.join('\n'));
  if (phase === 'release') {
    const before = JSON.parse(readFileSync(path.join(branch, `response/data/proofs/${consumerPhase('before')}.json`), 'utf8'));
    const proofProblems = consumerProofErrors(ctx, before, consumerPhase('before'), {});
    if (proofProblems.length) throw new Error(proofProblems.join('\n'));
    installedIdentity(ctx, 'before', ctx.artifact);
  }
  const files = consumerSnapshots(ctx), invocation = installInvocation(ctx, phase);
  const result = spawnSync(invocation.exe, invocation.args, { cwd: invocation.cwd, encoding: 'utf8', shell: false, windowsHide: true, maxBuffer: 64 * 1024 * 1024, timeout: 1200000 });
  const log = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const directory = path.join(branch, 'response/artifacts/install'); mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, `${phase}.log`), log);
  writeFileSync(path.join(directory, `${phase}.json`), JSON.stringify({ phase, base: ctx.packageCommit, planHash: ctx.consumerPlanHash, cwd: invocation.cwd, argv: invocation.args.slice(1), exitCode: result.status, logHash: hash(log) }, null, 2) + '\n');
  if (result.error || result.status !== 0) throw new Error(`consumer ${phase} install failed; inspect the session install log`);
  if (phase === 'baseline' && !same(files, consumerSnapshots(ctx))) throw new Error('baseline install changed dependency metadata');
  const afterErrors = worktreeErrors(ctx, { phase: phase === 'baseline' ? 'pristine' : 'consumer', head: ctx.packageCommit }); if (phase === 'release') afterErrors.push(...consumerChangeErrors(ctx));
  if (afterErrors.length) throw new Error(afterErrors.join('\n'));
  installedIdentity(ctx, phase === 'baseline' ? 'before' : 'after', ctx.artifact);
  return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { if (process.argv.length !== 4) throw new Error('usage: node install.mjs <branch> <baseline|release>'); await install(path.resolve(process.argv[2]), process.argv[3]); process.stdout.write('consumer installation verified\n'); }
  catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; }
}
