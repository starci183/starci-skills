// affected-test.mjs - `starci test affected`: the specs a change can break, and with --run each of them once, one file per process.
//
// Everyday verification is this set, not the whole suite and not a hand-picked file: the selection is the land gate's (affected-select.mjs),
// so a dependent's spec, a spec that spawns the CLI and the invariant specs are in it. The full suite is the merged-tree run and the release cut.
import fs from 'node:fs';
import path from 'node:path';
import { diff } from '../api/git/diff.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { mergeBase } from '../api/git/merge-base.mjs';
import { revParse } from '../api/git/rev-parse.mjs';
import { execNode } from '../api/node/exec-node.mjs';
import { readModuleJson } from '../../engine/runtime-root.mjs';
import { readSpecs } from '../lib/spec-pool.mjs';
import { changedExports, headRanges } from './land-specs.mjs';
import { affectedSelection, readSources } from './affected-select.mjs';
import { affectedBySymbol, symbolData, symbolLines } from './affected-symbols.mjs';
import { show } from '../api/git/show.mjs';
import { pathList } from '../machine/test-ladder.mjs';
import { resolveTestConcurrency } from '../machine/test-concurrency.mjs';
import { byCodeUnit } from '../lib/list.mjs';

const SCHEMA = 'starci/test-affected@1';
const RECEIPT_SCHEMA = 'starci/affected-receipt@1';
const PRELOADS = Object.freeze(['low-priority', 'isolated-temp', 'isolated-registry', 'runtime-copies'].map((name) => `./tests/setup/${name}.mjs`));
const TAIL_LINES = 25;

const lines = (text) => String(text ?? '').split(/\r?\n/).filter(Boolean);
const succeeded = (result) => result?.status === 0 && !result.error;

/** The merge-base of HEAD with the base ref (`main`, else `origin/main`, unless a ref is named), or null. */
export function baseOf(root, ref, deps = {}) {
  const candidates = ref ? [ref] : ['main', 'origin/main'];
  return candidates.map((candidate) => (deps.mergeBase ?? mergeBase)(root, 'HEAD', candidate)).find(Boolean) ?? null;
}

/** The repository files changed since `base`: committed, staged, working and untracked, deletions included. */
export function changedSince(root, base, deps = {}) {
  if (deps.changedFiles) return pathList(deps.changedFiles(root, base));
  const tracked = (deps.diff ?? diff)(['--name-only', '--diff-filter=ACMRD', base], { cwd: root });
  const untracked = (deps.lsFiles ?? lsFiles)(['--others', '--exclude-standard'], { cwd: root });
  return pathList([...lines(tracked.stdout), ...lines(untracked.stdout)]).sort(byCodeUnit);
}

// The exports the diff of one changed file against `base` reaches (the land gate's hub narrowing), or an unmapped answer.
export function symbolsAgainst({ root, base, deps }, file) {
  if (!file.endsWith('.mjs')) return { symbols: null, why: 'not a .mjs file' };
  const result = (deps.diff ?? diff)(['-U0', '--no-color', base, '--', file], { cwd: root });
  let source;
  try { source = fs.readFileSync(path.join(root, file), 'utf8'); } catch { return { symbols: null, why: 'file unreadable' }; }
  return succeeded(result) ? changedExports({ source, ranges: headRanges(result.stdout) }) : { symbols: null, why: 'diff unreadable' };
}
// The lines the diff of `file` against `base` adds and removes (affected-data.mjs): a file git cannot diff adds and removes nothing it can name.
function diffLinesAgainst({ root, base, deps }, file) {
  const result = (deps.diff ?? diff)(['-U0', '--no-color', base, '--', file], { cwd: root });
  const lines = succeeded(result) ? String(result.stdout ?? '').split(/\r?\n/) : [];
  const pick = (sign) => lines.filter((line) => line.startsWith(sign) && !line.startsWith(sign.repeat(3))).map((line) => line.slice(1));
  return { added: pick('+'), removed: pick('-') };
}

// The text of `file` at the diff base, or null when the base has none (a new file) or git cannot answer.
function baseSourceOf({ root, base, deps }, file) {
  const result = (deps.show ?? show)([`${base}:${file}`], { cwd: root });
  return succeeded(result) ? String(result.stdout) : null;
}

function policyOf(deps) {
  const policy = deps.policy ?? readModuleJson('modules', 'supervisor', 'affected-tests.yaml');
  if (!Number.isSafeInteger(policy?.maxFiles) || policy.maxFiles < 1) throw new Error('modules/supervisor/affected-tests.yaml maxFiles must be a positive integer');
  if (!Array.isArray(policy.dataRoots) || !policy.dataRoots.every((root) => typeof root === 'string' && root)) throw new Error('modules/supervisor/affected-tests.yaml dataRoots must list directory names');
  if (!Number.isSafeInteger(policy.symbolDepth) || policy.symbolDepth < 1) throw new Error('modules/supervisor/affected-tests.yaml symbolDepth must be a positive integer');
  if (!Number.isSafeInteger(policy.budgetMs) || policy.budgetMs < 1) throw new Error('modules/supervisor/affected-tests.yaml budgetMs must be a positive integer');
  if (!Array.isArray(policy.generated) || !policy.generated.every((entry) => entry?.output && entry?.generator)) throw new Error('modules/supervisor/affected-tests.yaml generated must list {output, generator}');
  return policy;
}

// The number of failing tests in the output of one `node --test` run (the reporter's own `fail N` summary line), or null when the output holds none.
const failingTestsIn = (output) => {
  const counts = [...output.matchAll(/^(?:ℹ|#) fail (\d+)\s*$/gm)];
  return counts.length ? Number(counts.at(-1)[1]) : null;
};

/** One spec file as its own `node --test` process with the four preloads: {file, pass, ms, tail, failedTests}. */
export async function runSpecFile(root, file, deps = {}) {
  const args = [...PRELOADS.flatMap((preload) => ['--import', preload]), '--test', file];
  const started = Date.now();
  const result = await (deps.execNode ?? execNode)(args, { cwd: root, maxBuffer: 1024 * 1024 * 1024 });
  const pass = !result.error;
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  return { file, pass, ms: Date.now() - started, tail: pass ? [] : lines(output).slice(-TAIL_LINES), failedTests: pass ? 0 : failingTestsIn(output) };
}

/** Run `files` with at most `limit` processes at once: the results in the order of `files`. */
export function runBounded(files, limit, runOne) {
  const results = new Array(files.length);
  let next = 0;
  const lane = () => {
    if (next >= files.length) return Promise.resolve();
    const index = next++;
    return runOne(files[index]).then((result) => { results[index] = result; return lane(); });
  };
  return Promise.all(Array.from({ length: Math.min(limit, files.length) }, lane)).then(() => results);
}

const verdictLine = (r) => `${r.pass ? 'PASS' : 'FAIL'} ${r.file} (${(r.ms / 1000).toFixed(1)}s)`;
const reply = (code, text, data) => ({ code, text, data: { schema: SCHEMA, ...data } });

function selectionHead({ base, changed, picked }) {
  const since = base ? ` since ${String(base).slice(0, 9)}` : '';
  const head = `affected: ${picked.files.length} spec file(s) for ${changed.length} changed file(s)${since}`;
  const readers = picked.readers.map((r) => `  data reader ${r.file} reads ${r.reads.join(', ')}`);
  return [head, ...symbolLines(picked), ...readers];
}
const selectionText = (parts) => [...selectionHead(parts), ...parts.picked.files.map((file) => `  ${file}`)];

const largeText = (picked) => `affected: ${picked.files.length} spec files, above the ${picked.maxFiles} of an ordinary change: run in parallel shards inside the time budget`;
const minutes = (ms) => `${Math.round(ms / 60_000)} min`;

/** The plan lines: each selected file with the reasons it is in the set (the first three, by symbol or rule). */
function planLines(picked) {
  const reasons = picked.reasons ?? {};
  const why = (file) => (reasons[file]?.length ? '  <- ' + reasons[file].join('; ') : '');
  return picked.files.map((file) => '  ' + file + why(file));
}

/** The receipt a deploy or land gate requires: which files ran for base..tip and how many passed; `clean` = no uncommitted change stood beside the commit. */
export function receiptOf({ root, base, picked, results, concurrency, startedAt, budgetMs, deps = {} }) {
  const tip = (deps.revParse ?? revParse)(root, 'HEAD');
  const passed = results.filter((r) => r.pass).length;
  const changedNow = String((deps.diff ?? diff)(['--name-only', 'HEAD'], { cwd: root }).stdout ?? '').trim();
  const untracked = String((deps.lsFiles ?? lsFiles)(['--others', '--exclude-standard'], { cwd: root }).stdout ?? '').trim();
  return { schema: RECEIPT_SCHEMA, base: base ? String(base) : null, tip: tip ?? null, clean: !changedNow && !untracked, files: picked.files.length, passed, total: results.length,
    ok: results.length === picked.files.length && passed === results.length, ms: Date.now() - startedAt, budgetMs, concurrency: concurrency.concurrency };
}

async function runSelection({ root, picked, args, deps, base, budgetMs }) {
  const decision = resolveTestConcurrency(args.concurrency, deps);
  const progress = deps.progress ?? ((line) => process.stderr.write(line + '\n'));
  const startedAt = Date.now();
  progress(`affected: ${picked.files.length} file(s), concurrency ${decision.concurrency}, budget ${minutes(budgetMs)}`);
  const timedOut = () => Date.now() - startedAt >= budgetMs;
  const results = await runBounded(picked.files, decision.concurrency, (file) => (timedOut()
    ? Promise.resolve({ file, pass: false, ms: 0, tail: ['not started: the time budget ended'], failedTests: null, skipped: true })
    : runSpecFile(root, file, deps).then((result) => { progress(verdictLine(result)); return result; })));
  const skipped = results.filter((r) => r.skipped);
  const failed = results.filter((r) => !r.pass && !r.skipped);
  const out = results.map((r) => (r.skipped ? `SKIP ${r.file} (budget)` : verdictLine(r)));
  for (const r of failed) out.push(`--- ${r.file}`, ...r.tail.map((line) => `  ${line}`));
  const known = failed.filter((r) => r.failedTests !== null);
  const failedTests = known.length === failed.length ? known.reduce((sum, r) => sum + r.failedTests, 0) : null;
  const tests = failed.length && failedTests !== null ? `; failing tests: ${failedTests}` : '';
  const budget = skipped.length ? `; ${skipped.length} not started inside the ${minutes(budgetMs)} budget` : '';
  out.push(`affected: elapsed ${((Date.now() - startedAt) / 1000).toFixed(0)}s`,
    `affected: ${results.length} files, ${results.length - failed.length - skipped.length} pass, ${failed.length} fail${tests}${budget}`);
  const receipt = receiptOf({ root, base, picked, results, concurrency: decision, startedAt, budgetMs, deps });
  let code = 0;
  if (failed.length) code = 1;
  else if (skipped.length) code = 2;
  const rows = results.map(({ file, pass, ms, failedTests: count, skipped: notRun }) => ({ file, pass, ms, failedTests: count, ...(notRun ? { skipped: true } : {}) }));
  return reply(code, out.join('\n'), { ok: code === 0, scope: picked.files, results: rows, failedTests, concurrency: decision, receipt });
}

/** `starci test affected [--base <ref>] [--changed <file...>] [--by symbol|file] [--run] [--concurrency <n>]`. */
export async function testAffected(ctx, deps = {}) {
  const args = ctx?.args ?? {};
  if (args.by !== undefined && !['file', 'symbol'].includes(args.by)) return reply(2, 'starci test affected: --by is file or symbol', { ok: false, scope: [] });
  const root = path.resolve(ctx?.cwd ?? process.cwd(), args.root ?? '.');
  const explicit = pathList(args.changed);
  const base = explicit.length && !args.base ? null : baseOf(root, args.base, deps);
  if (!explicit.length && !base) return reply(2, 'starci test affected: no base to diff against (no main or origin/main here); pass --base <ref> or --changed <file...>', { ok: false, scope: [] });
  const changed = explicit.length ? explicit : changedSince(root, base, deps);
  const policy = policyOf(deps);
  const diffBase = base ?? (deps.revParse ?? revParse)(root, 'HEAD');
  const common = {
    root, changed, specs: deps.specs ?? readSpecs(root), sources: deps.sources ?? readSources(root), maxFiles: policy.maxFiles, dataRoots: policy.dataRoots,
    diffOf: (file) => diffLinesAgainst({ root, base: diffBase, deps }, file), generated: policy.generated, verbCovered: policy.verbCovered ?? [],
    exists: deps.exists ?? ((file) => fs.existsSync(path.join(root, file))), symbolsOf: (file) => symbolsAgainst({ root, base: diffBase, deps }, file),
  };
  const picked = args.by === 'file' ? affectedSelection(common) : affectedBySymbol({ ...common, depth: policy.symbolDepth, baseSource: (file) => baseSourceOf({ root, base: diffBase, deps }, file) });
  const data = { ok: true, scope: picked.files, changed, base, readers: picked.readers, narrowed: picked.narrowed, large: picked.over, maxFiles: picked.maxFiles, reasons: picked.reasons ?? {}, ...symbolData(picked) };
  const header = picked.over ? [largeText(picked)] : [];
  if (args.plan) return reply(0, [...selectionHead({ base, changed, picked }), ...header, ...planLines(picked)].join('\n'), data);
  if (!args.run) return reply(0, [...selectionText({ base, changed, picked }), ...header].join('\n'), data);
  const empty = { concurrency: 0 };
  if (!picked.files.length) return reply(0, 'affected: 0 files, 0 pass, 0 fail', { ...data, results: [], receipt: receiptOf({ root, base: diffBase, picked, results: [], concurrency: empty, startedAt: Date.now(), budgetMs: policy.budgetMs, deps }) });
  const run = await runSelection({ root, picked, args, deps, base: diffBase, budgetMs: policy.budgetMs });
  return { ...run, data: { ...data, ...run.data } };
}
