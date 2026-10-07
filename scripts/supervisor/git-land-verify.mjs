// git-land-verify.mjs — full runtime check, dependency-selected specs, one serial red-file rerun, and durable land logs.
import fs from 'node:fs';
import path from 'node:path';
import { runNode as runNodeCall } from '../api/node/run-node.mjs';
import { fullCheck as fullCheckCall } from './land-full-check.mjs';
import { specsDependingOn as specsDependingOnCall } from '../lib/spec-deps.mjs';
import { walkFiles } from '../lib/walk.mjs';
import { specRunEnv, specTimeoutMs } from './land.mjs';
import { byCodeUnit } from '../lib/list.mjs';
import { tempPath } from '../api/fs/temp-path.mjs';

const posix = (p) => p.replaceAll(String.fromCodePoint(92), '/');
const outputOf = (r) => `${String(r?.stdout ?? '')}${String(r?.stderr ?? r?.error?.message ?? '')}`;
const okOf = (r) => !r?.error && r?.status === 0;

/** Convert the human runtime-check summary to the check pass/total trailer counts. */
export function checkCounts(text, ok) {
  let pass = 0, total = 0;
  const syntax = /node --check:\s*(\d+) files,\s*(\d+) failed/.exec(text);
  if (syntax) { total += Number(syntax[1]); pass += Number(syntax[1]) - Number(syntax[2]); }
  if (/^OK: runtime HFS /m.test(text)) { total += 1; pass += 1; }
  else if (/^runtime HFS:/m.test(text)) total += 1;
  const self = /self-checks:\s*(\d+) of (\d+) passed/.exec(text);
  if (self) { pass += Number(self[1]); total += Number(self[2]); }
  return total ? { pass, total } : { pass: ok ? 1 : 0, total: 1 };
}

/** Run the candidate's exact `starci runtime check` entry and retain its complete output. */
export function runLandFullCheck(worktree, deps = {}) {
  const runner = deps.runNode
    ? (args, options) => { const r = deps.runNode(args, options); return { ok: okOf(r), stdout: String(r.stdout ?? ''), stderr: String(r.stderr ?? r.error?.message ?? '') }; }
    : undefined;
  const result = (deps.fullCheck ?? fullCheckCall)(worktree, runner);
  if (result.skipped) return { ok: false, output: 'packages/cli/bin/starci.mjs is missing; the full runtime check did not run', pass: 0, total: 1 };
  const counts = checkCounts(result.full, result.ok);
  return { ok: result.ok, output: result.full, ...counts };
}

const specFiles = (worktree) => {
  const root = path.join(worktree, 'tests');
  if (!fs.existsSync(root)) return [];
  return walkFiles(root, { sorted: true, filter: (name) => name.endsWith('.spec.mjs'), exclude: (name) => name === 'node_modules' })
    .map((file) => posix(path.relative(worktree, file)));
};

const FAILED_TITLE_LINE = new RegExp([String.raw`^✖\s+`, '(.+?)', String.raw`(?:\s+\([0-9.]+m?s\))?`, '$'].join(''));

/** Failed test titles from node's spec reporter, with the duration suffix removed exactly as land-to-main.sh did. */
function failedTitles(text) {
  return [...new Set(String(text ?? '').split(/\r?\n/).map((line) => {
    const match = FAILED_TITLE_LINE.exec(line.trim());
    return match && match[1] !== 'failing tests' ? match[1] : null;
  }).filter(Boolean))];
}

/** Map reporter file lines and failing titles back to the selected spec files. */
function redSpecFiles(text, worktree, selected) {
  const allowed = new Set(selected.map(posix)), direct = new Set();
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const match = /^✖\s+(tests[\\/][^\s]+\.spec\.mjs)(?:\s|$)/.exec(line.trim());
    if (match && allowed.has(posix(match[1]))) direct.add(posix(match[1]));
  }
  if (direct.size) return [...direct].sort(byCodeUnit);
  const titles = failedTitles(text), red = [];
  for (const file of selected) {
    let source = '';
    try { source = fs.readFileSync(path.join(worktree, file), 'utf8'); } catch { continue; }
    if (titles.some((title) => source.includes(title))) red.push(file);
  }
  return [...new Set(red)].sort(byCodeUnit);
}

/** Prior-red files from a verified run log, even when the reporter named only test titles. */
function priorRedSpecFiles(worktree, verifiedLog, specs = specFiles(worktree)) {
  if (!verifiedLog) return [];
  return redSpecFiles(fs.readFileSync(verifiedLog, 'utf8'), worktree, specs);
}

/** Dependency selection for changed files plus every spec that was red in the verified log. */
export function selectLandSpecs({ worktree, changed, verifiedLog = null }, deps = {}) {
  const specs = deps.specFiles ? deps.specFiles(worktree) : specFiles(worktree);
  const depending = (deps.specsDependingOn ?? specsDependingOnCall)(worktree, changed, specs);
  const priorRed = verifiedLog ? priorRedSpecFiles(worktree, verifiedLog, specs) : [];
  return { files: [...new Set([...depending, ...priorRed])].sort(byCodeUnit), priorRed };
}

const argsFor = (files, concurrency) => [
  '--import', './tests/setup/low-priority.mjs',
  '--import', './tests/setup/isolated-temp.mjs',
  '--import', './tests/setup/isolated-registry.mjs',
  '--test', `--test-concurrency=${concurrency}`, ...files,
];

/** Run selected files, rerunning only mapped red files once with concurrency one. */
export function runLandSpecs({ worktree, tip, files, concurrency = 4 }, deps = {}) {
  const runNode = deps.runNode ?? runNodeCall;
  const log = tempPath(`land-specs-${String(tip).slice(0, 7)}.txt`);
  const env = deps.specEnv ?? specRunEnv(deps.env ?? process.env);
  const first = runNode(argsFor(files, concurrency), { cwd: worktree, encoding: 'utf8', env, timeout: deps.timeout ?? specTimeoutMs(files.length), maxBuffer: 256 * 1024 * 1024 });
  const firstOutput = outputOf(first);
  fs.writeFileSync(log, firstOutput);
  if (okOf(first)) return { ok: true, selected: files.length, pass: files.length, rerun: 0, log, files };
  const red = redSpecFiles(firstOutput, worktree, files);
  if (!red.length) return { ok: false, cause: 'red-files-unknown', detail: 'the spec run was red but no failing spec file could be identified', selected: files.length, pass: 0, rerun: 0, log, files };
  const rerun = runNode(argsFor(red, 1), { cwd: worktree, encoding: 'utf8', env, timeout: deps.timeout ?? specTimeoutMs(red.length), maxBuffer: 256 * 1024 * 1024 });
  const rerunOutput = outputOf(rerun);
  fs.appendFileSync(log, `\n# targeted rerun (${red.length} file(s), concurrency 1)\n${rerunOutput}`);
  if (!okOf(rerun)) return { ok: false, cause: 'red-after-rerun', detail: 'the targeted serial rerun is still red', selected: files.length, pass: Math.max(0, files.length - red.length), rerun: red.length, log, files, red };
  return { ok: true, selected: files.length, pass: files.length, rerun: red.length, log, files, red };
}

const isCode = (file) => /^(scripts|engine|bin|tests|packages|modules)\/.*\.(mjs|js|cjs|ts|yaml|json)$/.test(posix(file));

/** Select and run the land specs; code with an empty selection is always a refusal. */
export function verifyLandSpecs({ worktree, tip, changed, verifiedLog = null, concurrency = 4 }, deps = {}) {
  const selection = selectLandSpecs({ worktree, changed, verifiedLog }, deps);
  const codeChanged = changed.filter(isCode).length;
  if (codeChanged && !selection.files.length) return { ok: false, cause: 'selection-empty', detail: `${codeChanged} code file(s) changed but 0 specs were selected`, selected: 0, pass: 0, rerun: 0, log: null, files: [], priorRed: selection.priorRed };
  if (!selection.files.length) return { ok: true, selected: 0, pass: 0, rerun: 0, log: null, files: [], priorRed: selection.priorRed };
  return { ...runLandSpecs({ worktree, tip, files: selection.files, concurrency }, deps), priorRed: selection.priorRed };
}
