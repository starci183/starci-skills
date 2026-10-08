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
import { pathList } from '../machine/test-ladder.mjs';
import { resolveTestConcurrency } from '../machine/test-concurrency.mjs';
import { byCodeUnit } from '../lib/list.mjs';

const SCHEMA = 'starci/test-affected@1';
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
function symbolsAgainst({ root, base, deps }, file) {
  if (!file.endsWith('.mjs')) return { symbols: null, why: 'not a .mjs file' };
  const result = (deps.diff ?? diff)(['-U0', '--no-color', base, '--', file], { cwd: root });
  let source;
  try { source = fs.readFileSync(path.join(root, file), 'utf8'); } catch { return { symbols: null, why: 'file unreadable' }; }
  return succeeded(result) ? changedExports({ source, ranges: headRanges(result.stdout) }) : { symbols: null, why: 'diff unreadable' };
}

function policyOf(deps) {
  const policy = deps.policy ?? readModuleJson('modules', 'supervisor', 'affected-tests.yaml');
  if (!Number.isSafeInteger(policy?.maxFiles) || policy.maxFiles < 1) throw new Error('modules/supervisor/affected-tests.yaml maxFiles must be a positive integer');
  if (!Array.isArray(policy.dataRoots) || !policy.dataRoots.every((root) => typeof root === 'string' && root)) throw new Error('modules/supervisor/affected-tests.yaml dataRoots must list directory names');
  return policy;
}

/** One spec file as its own `node --test` process with the four preloads: {file, pass, ms, tail}. */
export async function runSpecFile(root, file, deps = {}) {
  const args = [...PRELOADS.flatMap((preload) => ['--import', preload]), '--test', file];
  const started = Date.now();
  const result = await (deps.execNode ?? execNode)(args, { cwd: root, maxBuffer: 1024 * 1024 * 1024 });
  const pass = !result.error;
  return { file, pass, ms: Date.now() - started, tail: pass ? [] : lines(`${result.stdout ?? ''}\n${result.stderr ?? ''}`).slice(-TAIL_LINES) };
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

function selectionText({ base, changed, picked }) {
  const since = base ? ` since ${String(base).slice(0, 9)}` : '';
  const head = `affected: ${picked.files.length} spec file(s) for ${changed.length} changed file(s)${since}`;
  const readers = picked.readers.map((r) => `  data reader ${r.file} reads ${r.reads.join(', ')}`);
  return [head, ...readers, ...picked.files.map((file) => `  ${file}`)];
}

const overText = (picked) => `affected: ${picked.files.length} spec files exceed the declared bound of ${picked.maxFiles} (modules/supervisor/affected-tests.yaml); `
  + 'not run. A change this wide is verified by the full suite on the merged tree (the lead) and by the release cut, not by a lane.';

async function runSelection({ root, picked, args, deps }) {
  const decision = resolveTestConcurrency(args.concurrency, deps);
  const results = await runBounded(picked.files, decision.concurrency, (file) => runSpecFile(root, file, deps));
  const failed = results.filter((r) => !r.pass);
  const out = results.map(verdictLine);
  for (const r of failed) out.push(`--- ${r.file}`, ...r.tail.map((line) => `  ${line}`));
  out.push(`affected: ${results.length} files, ${results.length - failed.length} pass, ${failed.length} fail`);
  return reply(failed.length ? 1 : 0, out.join('\n'), { ok: !failed.length, scope: picked.files, results: results.map(({ file, pass, ms }) => ({ file, pass, ms })), concurrency: decision });
}

/** `starci test affected [--base <ref>] [--changed <file...>] [--run] [--concurrency <n>]`. */
export async function testAffected(ctx, deps = {}) {
  const args = ctx?.args ?? {};
  const root = path.resolve(ctx?.cwd ?? process.cwd(), args.root ?? '.');
  const explicit = pathList(args.changed);
  const base = explicit.length && !args.base ? null : baseOf(root, args.base, deps);
  if (!explicit.length && !base) return reply(2, 'starci test affected: no base to diff against (no main or origin/main here); pass --base <ref> or --changed <file...>', { ok: false, scope: [] });
  const changed = explicit.length ? explicit : changedSince(root, base, deps);
  const policy = policyOf(deps);
  const diffBase = base ?? (deps.revParse ?? revParse)(root, 'HEAD');
  const picked = affectedSelection({
    root, changed, specs: deps.specs ?? readSpecs(root), sources: deps.sources ?? readSources(root), maxFiles: policy.maxFiles, dataRoots: policy.dataRoots,
    exists: deps.exists ?? ((file) => fs.existsSync(path.join(root, file))), symbolsOf: (file) => symbolsAgainst({ root, base: diffBase, deps }, file),
  });
  const data = { ok: true, scope: picked.files, changed, base, readers: picked.readers, narrowed: picked.narrowed, over: picked.over, maxFiles: picked.maxFiles };
  if (picked.over) return reply(args.run ? 2 : 0, [...selectionText({ base, changed, picked }), overText(picked)].join('\n'), { ...data, ok: !args.run });
  if (!args.run) return reply(0, selectionText({ base, changed, picked }).join('\n'), data);
  if (!picked.files.length) return reply(0, 'affected: 0 files, 0 pass, 0 fail', { ...data, results: [] });
  const run = await runSelection({ root, picked, args, deps });
  return { ...run, data: { ...data, ...run.data } };
}
