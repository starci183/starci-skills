// Runs one proof phase of library.update and records it: a package phase (`before`, `after`, a
// package gate id) runs in the owner package before the package commit; a consumer phase
// (`consumer-before`, `consumer-after`, `consumer-<gate>`) runs at the consumer root after the commit
// the consumer half starts from, with COVERAGE_BASE_SHA bound to that commit for test:ci. A phase of a
// half this branch's mode does not run is refused. Only existing scripts or the regression binary of a
// declared dependency run, with argument arrays and no shell.
//   node run-proof.mjs <branch> <phase>
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContext, worktreeErrors, changeErrors, consumerChangeErrors, resolveCommand, consumerCommand, snapshots, consumerSnapshots, baseWorkingBytes, hash, git, same, regressionFailed, proofEnvironment, installedIdentity, bindRelease, runsPackageHalf, runsConsumerHalf, bareConsumerPhase, CONSUMER } from './validate.mjs';

export async function runProof(branch, phase) {
  const ctx = await loadContext(branch);
  const consumer = phase.startsWith(CONSUMER);
  if (consumer ? !runsConsumerHalf(ctx.mode) : !runsPackageHalf(ctx.mode)) throw new Error(`mode ${ctx.mode} runs no ${consumer ? 'consumer' : 'package'} half, so it proves no ${phase}`);
  const bare = bareConsumerPhase(phase);
  const plan = consumer ? ctx.consumer : ctx.plan;
  const command = ['before', 'after'].includes(bare) ? plan.regression.command : plan.gates.find((g) => g.id === bare)?.command;
  if (!command) throw new Error('phase is neither a regression phase nor a declared gate');
  const errors = [];
  let files;
  let proof;
  const resolved = consumer ? consumerCommand(ctx, command) : resolveCommand(ctx, command);
  if (!consumer) {
    errors.push(...worktreeErrors(ctx, { phase: 'package' }));
    files = snapshots(ctx);
    if (bare === 'before') {
      for (const file of ctx.plan.files) if (file.kind !== 'test' && files[file.path] !== hash(baseWorkingBytes(ctx.checkout, ctx.base, file.path))) errors.push(`before regression requires unchanged base file: ${file.path}`);
      if (!ctx.plan.files.some((f) => f.kind === 'test' && files[f.path] !== (baseWorkingBytes(ctx.checkout, ctx.base, f.path) ? hash(baseWorkingBytes(ctx.checkout, ctx.base, f.path)) : null))) errors.push('before regression requires the new paired test');
    } else errors.push(...changeErrors(ctx));
  } else {
    bindRelease(ctx);
    errors.push(...worktreeErrors(ctx, { phase: bare === 'before' ? 'pristine' : 'consumer', head: ctx.packageCommit }));
    if (bare !== 'before') errors.push(...consumerChangeErrors(ctx));
    files = consumerSnapshots(ctx);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  const installed = consumer ? installedIdentity(ctx, bare, ctx.artifact) : null;
  const environment = consumer ? proofEnvironment(ctx, command) : {};
  const startedAt = new Date().toISOString();
  const result = spawnSync(resolved.exe, resolved.args, { cwd: consumer ? ctx.checkout : ctx.packageDir, env: { ...process.env, ...environment }, encoding: 'utf8', windowsHide: true, shell: false, maxBuffer: 64 * 1024 * 1024, timeout: 1200000 });
  if (result.error || result.status === null) throw new Error('declared proof process did not complete');
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const after = consumer ? consumerSnapshots(ctx) : snapshots(ctx);
  if (!same(files, after)) throw new Error('proof command changed declared inputs');
  const outputRef = `response/artifacts/proofs/${phase}.log`;
  mkdirSync(path.dirname(path.join(branch, outputRef)), { recursive: true });
  writeFileSync(path.join(branch, outputRef), output);
  if (consumer) proof = { phase, base: ctx.packageCommit, planHash: ctx.consumerPlanHash, command, commandHash: resolved.commandHash, environment, files, regressionHash: hash(readFileSync(path.join(ctx.checkout, ctx.consumer.regression.file))), installed, exitCode: result.status, outputRef, outputHash: hash(output), startedAt, finishedAt: new Date().toISOString() };
  else proof = { phase, planHash: ctx.planHash, base: ctx.base, head: ctx.base, command, commandHash: resolved.commandHash, files, exitCode: result.status, outputRef, outputHash: hash(output), startedAt, finishedAt: new Date().toISOString() };
  const folder = path.join(branch, 'response/data/proofs');
  mkdirSync(folder, { recursive: true });
  writeFileSync(path.join(folder, `${phase}.json`), JSON.stringify(proof, null, 2) + '\n');
  const expected = bare === 'before' ? result.status > 0 && regressionFailed(output, plan.regression.assertion) : result.status === 0;
  process.stdout.write(`${phase}: exit ${result.status}, expected outcome ${expected ? 'proved' : 'not proved'}\n`);
  return expected;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { if (!process.argv[2] || !process.argv[3]) throw new Error('usage: node run-proof.mjs <branch> <before|after|gate-id|consumer-before|consumer-after|consumer-gate-id>'); if (!await runProof(path.resolve(process.argv[2]), process.argv[3])) process.exitCode = 1; }
  catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; }
}
