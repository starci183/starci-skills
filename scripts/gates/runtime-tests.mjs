// runtime-tests.mjs - the real tests of a runtime commit (owner ruling no-runtime-specs, 2026-10-17): the runtime has no specs of its own, so a change is proven by
//   1. the clean-install proof of every published package the change touches (`starci release clean-test --base <base>`, scripts/gates/package-clean-test.mjs), and
//   2. the scaffold end-to-end proof (`starci release scaffold-e2e`, scripts/gates/scaffold-e2e.mjs), always.
// `starci runtime verify` and `starci runtime deploy` run it and bind its numbers into their receipt. Every process goes through a seam (`deps`).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runNode } from '../api/node/run-node.mjs';
import { tailLines } from '../lib/clip.mjs';
import { runScaffoldE2e } from './scaffold-e2e.mjs';

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SUMMARY = /package-clean-test: (\d+) green, (\d+) red, (\d+) not run, of (\d+)/;
const NONE_CHANGED = /package-clean-test: no published package changed/;
const tail = (text) => tailLines(text, 4, { join: ' | ', max: 600 });

/** The packages leg: {ok, green, total, detail}. A run that printed no summary, or one with a red or unrun package, is not ok. */
function packagesLeg({ root, base, env, node }) {
  const run = node([path.join(root, 'scripts', 'gates', 'package-clean-test.mjs'), '--base', base], { cwd: root, env, maxBuffer: 256 * 1024 * 1024 });
  const out = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
  if (run.status === 0 && NONE_CHANGED.test(out)) return { ok: true, green: 0, total: 0, detail: 'no published package changed' };
  const summary = SUMMARY.exec(out);
  if (!summary) return { ok: false, green: 0, total: 0, detail: `release clean-test --base ${base.slice(0, 12)} printed no summary (exit ${run.status ?? run.error?.message}): ${tail(out)}` };
  const [green, red, unrun, total] = summary.slice(1).map(Number);
  const ok = run.status === 0 && red === 0 && unrun === 0 && green === total;
  return { ok, green, total, detail: ok ? summary[0] : `${summary[0]}: ${tail(out)}` };
}

/** The real tests of `root` against `base`: {ok, packages:{green,total}, e2e:{pass,total}, ms, problems}. */
export function runRuntimeTests({ root = runtimeRoot, base, env = process.env, progress = () => {}, deps = {} }) {
  const node = deps.runNode ?? runNode;
  const started = Date.now();
  progress(`tests: release clean-test --base ${base.slice(0, 12)} in ${root} (the packages the change touches)`);
  const packages = (deps.packagesLeg ?? packagesLeg)({ root, base, env, node });
  progress(`tests: ${packages.detail}`);
  progress(`tests: release scaffold-e2e in ${root} (minutes)`);
  const e2e = (deps.scaffoldE2e ?? runScaffoldE2e)({ root, env });
  progress(`tests: ${e2e.line}`);
  const failing = e2e.failing?.length ? '; failing: ' + e2e.failing.join(' | ') : '';
  const problems = [...(packages.ok ? [] : [packages.detail]), ...(e2e.ok ? [] : [e2e.line + failing])];
  return { ok: problems.length === 0, packages: { green: packages.green, total: packages.total }, e2e: { pass: e2e.pass, total: e2e.total }, ms: Date.now() - started, problems };
}
