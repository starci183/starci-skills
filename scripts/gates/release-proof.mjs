#!/usr/bin/env node
// release-proof.mjs - the release proof (schema starci/release-proof@1) release.deliver attaches before a publish or a deploy
// (knowledge/op-gate.yaml proofs.release, contract change op-mechanism-proofs).
//
//   starci release proof --repo <released repository> --base <first commit of the release range>^ [--main <ref>] [--out <file>]
//
// Every step is required and none may be skipped:
//   app-installs  scripts/gates/release-app-installs.mjs: the published hfs scaffolds an app, the app installs FRESH from the
//                 npm registry, and the scaffold spec runs its lint, typecheck and api boot proofs with installs required; a
//                 `SKIPPED:` line in its output is a skip, never a pass;
//   canon-pins    scripts/checks/check-canon-pins.mjs --json in the runtime (every pin, and every code-pattern profile bound to
//                 its published canon by the content digest) and, when the released repository is an app, --repo against it;
//   merge-guard   the gate's merge guard over base..HEAD of the released repository (scripts/gates/gate.mjs mergeGuard): a merge
//                 that kept the lane side over a main change is red;
//   check         `npm run check` of the runtime.
// `starci kernel settle` re-reads the proof (scripts/kernel/gate-settle.mjs) and refuses a done release with a step missing, skipped or red.
// Exit 0 every step passed, 1 a step is red or skipped, 2 the proof could not be built.
import fs from 'node:fs';
import path from 'node:path';
import { runNode } from '../api/node/run-node.mjs';
import { runNpm } from '../api/npm/run-npm.mjs';
import { fileURLToPath } from 'node:url';
import { posixPath } from '../lib/path-key.mjs';
import { isMain } from '../lib/is-main.mjs';
import { mainTipOf, mergeGuard, resolveGateBase } from './gate.mjs';

export const RELEASE_PROOF_SCHEMA = 'starci/release-proof@1';
export const RELEASE_STEPS = Object.freeze(['app-installs', 'canon-pins', 'merge-guard', 'check']);
export const STEP_STATUS = Object.freeze({ pass: 'pass', red: 'red', skipped: 'skipped', toolFailed: 'tool-failed' });
const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const USAGE = 'usage: starci release proof --repo <released repository> --base <commit> [--main <ref>] [--out <file>]';
const tail = (text, n = 3) => String(text ?? '').trim().split(/\r?\n/).slice(-n).join(' | ').slice(0, 600);

const isApp = (repo) => { try { return JSON.parse(fs.readFileSync(path.join(repo, 'hfs.json'), 'utf8'))?.kind === 'app'; } catch { return false; } };

/** The default runners of a step's process (node <args>, npm <args>): {status, stdout, stderr, error}. */
const defaultNode = (args, opts) => runNode(args, { maxBuffer: 512 * 1024 * 1024, ...opts });
const defaultNpm = (args, opts) => runNpm(args, { maxBuffer: 512 * 1024 * 1024, ...opts });

export function appInstallsStep({ runtime = runtimeRoot, node = defaultNode } = {}) {
  const run = node([path.join(runtime, 'scripts', 'gates', 'release-app-installs.mjs')], { cwd: runtime });
  const output = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
  const skipped = output.split(/\r?\n/).filter((l) => /\bSKIPPED:/.test(l));
  const status = run.error || run.status === null ? STEP_STATUS.toolFailed : skipped.length ? STEP_STATUS.skipped : run.status === 0 ? STEP_STATUS.pass : STEP_STATUS.red;
  return { id: 'app-installs', command: 'starci release app-installs', exit: run.status ?? null, status,
    detail: skipped.length ? `a proof skipped: ${skipped.slice(0, 3).join(' | ')}` : tail(output) };
}

export function canonPinsStep({ repo, runtime = runtimeRoot, node = defaultNode } = {}) {
  const script = path.join(runtime, 'scripts', 'checks', 'check-canon-pins.mjs');
  const runs = [{ label: 'runtime', args: [script, '--json'] }, ...(repo && isApp(repo) ? [{ label: 'app', args: [script, '--repo', repo, '--json'] }] : [])];
  const results = runs.map(({ label, args }) => {
    const run = node(args, { cwd: runtime });
    let doc = null;
    try { doc = JSON.parse(run.stdout); } catch { doc = null; }
    return { label, exit: run.status ?? null, ok: doc?.ok === true, pins: doc?.pins ?? null, profiles: doc?.profiles ?? null, errors: doc?.errors ?? [], parsed: Boolean(doc), error: run.error };
  });
  const broken = results.find((r) => r.error || !r.parsed);
  const red = results.filter((r) => !r.ok);
  const runtimeResult = results[0];
  // The runtime judgment must have bound at least one code-pattern profile to its published canon by the content digest.
  const unbound = !broken && !(Number(runtimeResult.profiles) > 0);
  return { id: 'canon-pins', command: `starci runtime check --only canon-pins -- --json${results.length > 1 ? ' (+ --repo <app>)' : ''}`, exit: Math.max(...results.map((r) => r.exit ?? 2)),
    status: broken ? STEP_STATUS.toolFailed : red.length || unbound ? STEP_STATUS.red : STEP_STATUS.pass,
    profiles: runtimeResult.profiles, pins: runtimeResult.pins,
    detail: broken ? `check-canon-pins produced no JSON (${broken.label})` : unbound ? 'no code-pattern profile is bound to its canon content digest' : red.flatMap((r) => r.errors.map((e) => `${r.label}: ${e}`)).slice(0, 10).join(' | ') };
}

export function mergeGuardStep({ repo, base, main = null }) {
  try {
    const from = resolveGateBase(repo, base);
    const guard = mergeGuard(repo, { base: from, mainTip: mainTipOf(repo, main) });
    return { id: 'merge-guard', command: `starci gate run (merge guard ${from.slice(0, 12)}..HEAD)`, exit: guard.errors.length ? 2 : guard.findings.length ? 1 : 0,
      status: guard.errors.length ? STEP_STATUS.toolFailed : guard.findings.length ? STEP_STATUS.red : STEP_STATUS.pass, checked: guard.checked.length,
      detail: guard.errors.length ? guard.errors.join(' | ') : guard.findings.map((f) => f.message).slice(0, 5).join(' | ') };
  } catch (error) {
    return { id: 'merge-guard', command: 'starci gate run (merge guard)', exit: 2, status: STEP_STATUS.toolFailed, checked: 0, detail: String(error?.message ?? error) };
  }
}

export function checkStep({ runtime = runtimeRoot, npm = defaultNpm } = {}) {
  const run = npm(['run', 'check'], { cwd: runtime });
  return { id: 'check', command: 'starci runtime check', exit: run.status ?? null,
    status: run.error || run.status === null ? STEP_STATUS.toolFailed : run.status === 0 ? STEP_STATUS.pass : STEP_STATUS.red, detail: tail(`${run.stdout ?? ''}\n${run.stderr ?? ''}`) };
}

export function buildReleaseProof({ repo, base, main = null, runtime = runtimeRoot, node = defaultNode, npm = defaultNpm }) {
  const abs = path.resolve(repo);
  const steps = [appInstallsStep({ runtime, node }), canonPinsStep({ repo: abs, runtime, node }), mergeGuardStep({ repo: abs, base, main }), checkStep({ runtime, npm })];
  const ok = steps.every((s) => s.status === STEP_STATUS.pass);
  return { schema: RELEASE_PROOF_SCHEMA, at: new Date().toISOString(), repo: posixPath(abs), base, runtime: posixPath(runtime), steps, ok,
    exit: ok ? 0 : steps.some((s) => s.status === STEP_STATUS.toolFailed) ? 2 : 1 };
}

export function parseReleaseArgs(argv) {
  const opts = { repo: null, base: null, main: null, out: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (['--repo', '--base', '--main', '--out'].includes(arg)) {
      if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) throw new Error(`${arg} needs a value; ${USAGE}`);
      opts[arg.slice(2)] = argv[++i];
    } else throw new Error(`unknown argument ${arg}; ${USAGE}`);
  }
  if (!opts.repo || !opts.base) throw new Error(`--repo and --base are required; ${USAGE}`);
  return opts;
}

if (isMain(import.meta.url)) {
  try {
    const opts = parseReleaseArgs(process.argv.slice(2));
    const proof = buildReleaseProof(opts);
    const text = `${JSON.stringify(proof, null, 2)}\n`;
    if (opts.out) { fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true }); fs.writeFileSync(path.resolve(opts.out), text); }
    process.stdout.write(text);
    process.exitCode = proof.exit;
  } catch (error) {
    process.stderr.write(`release-proof: ${error.message}\n`);
    process.exitCode = 2;
  }
}
