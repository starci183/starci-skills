import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContext, worktreeErrors, changeErrors, resolveCommand, snapshots, baseWorkingBytes, hash, git, same, regressionFailed } from './validate.mjs';

export async function runProof(branch, phase) {
  const ctx = await loadContext(branch);
  const command = ['before', 'after'].includes(phase) ? ctx.plan.regression.command : ctx.plan.gates.find((g) => g.id === phase)?.command;
  if (!command) throw new Error('phase is neither regression nor a declared package gate');
  const errors = worktreeErrors(ctx);
  if (git(ctx.checkout, ['rev-parse', 'HEAD']) !== ctx.base) errors.push('proofs run before the delivery commit');
  const before = snapshots(ctx);
  if (phase === 'before') {
    for (const file of ctx.plan.files) if (file.kind !== 'test' && before[file.path] !== hash(baseWorkingBytes(ctx.checkout, ctx.base, file.path))) errors.push(`before regression requires unchanged base file: ${file.path}`);
    if (!ctx.plan.files.some((f) => f.kind === 'test' && before[f.path] !== (baseWorkingBytes(ctx.checkout, ctx.base, f.path) ? hash(baseWorkingBytes(ctx.checkout, ctx.base, f.path)) : null))) errors.push('before regression requires the new paired test');
  } else errors.push(...changeErrors(ctx));
  if (errors.length) throw new Error(errors.join('\n'));
  const resolved = resolveCommand(ctx, command);
  const startedAt = new Date().toISOString();
  const result = spawnSync(resolved.exe, resolved.args, { cwd: ctx.packageDir, encoding: 'utf8', windowsHide: true, shell: false, maxBuffer: 32 * 1024 * 1024, timeout: 600000 });
  if (result.error || result.status === null) throw new Error('declared proof process did not complete');
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const after = snapshots(ctx);
  if (!same(before, after) || worktreeErrors(ctx).length) throw new Error('proof command changed declared inputs or an undeclared tracked path');
  const outputRef = `response/artifacts/proofs/${phase}.log`;
  mkdirSync(path.dirname(path.join(branch, outputRef)), { recursive: true });
  writeFileSync(path.join(branch, outputRef), output);
  const proof = { phase, planHash: ctx.planHash, base: ctx.base, head: ctx.base, command, commandHash: resolved.commandHash, files: before, exitCode: result.status, outputRef, outputHash: hash(output), startedAt, finishedAt: new Date().toISOString() };
  const folder = path.join(branch, 'response/data/proofs');
  mkdirSync(folder, { recursive: true });
  writeFileSync(path.join(folder, `${phase}.json`), JSON.stringify(proof, null, 2) + '\n');
  const expected = phase === 'before' ? result.status > 0 && regressionFailed(output, ctx.plan.regression.assertion) : result.status === 0;
  process.stdout.write(`${phase}: exit ${result.status}, expected outcome ${expected ? 'proved' : 'not proved'}\n`);
  return expected;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { if (!process.argv[2] || !process.argv[3]) throw new Error('usage: node run-proof.mjs <branch> <before|after|gate-id>'); if (!await runProof(path.resolve(process.argv[2]), process.argv[3])) process.exitCode = 1; }
  catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; }
}
