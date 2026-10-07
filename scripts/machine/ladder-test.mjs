// ladder-test.mjs - `starci test run`: targeted/dependent/full spec execution with the release and host-lock policy.
import fs from 'node:fs';
import path from 'node:path';
import { isAncestor } from '../api/git/is-ancestor.mjs';
import { revParse } from '../api/git/rev-parse.mjs';
import { runNode } from '../api/node/run-node.mjs';
import { specsDependingOn } from '../lib/spec-deps.mjs';
import { underHostLock } from './verb-lock.mjs';
import { checkRun } from './ladder-check.mjs';
import { cleanTree, committedChanges, tracked, workingChanges, runOutcome } from './ladder-select.mjs';
import { ladderRefusal, ladderResult, pathList, scopeFor } from './test-ladder.mjs';
import { resolveTestConcurrency } from './test-concurrency.mjs';
import { byCodeUnit } from '../lib/list.mjs';
import { tempRoot } from '../../engine/temp-root.mjs';

const SCHEMA = 'starci/test-run@1';
const PRELOADS = Object.freeze(['tests/setup/low-priority.mjs', 'tests/setup/isolated-temp.mjs', 'tests/setup/isolated-registry.mjs']);
const CODE_FILE = /\.(?:[cm]?[jt]sx?|json)$/i;
const BOUNDARY_SPEC = /(?:(?:^|\/)(?:integration|contract|e2e)(?:\/|[-.])|[.-](?:integration|contract|e2e)[.-])/i;
const IO_PATH = new RegExp([
  String.raw`(?:^|\/)(?:db|database|queue|kafka|webhooks?|sagas?|jobs?|events?|contracts?)`,
  String.raw`(?:\/|[-.])`,
].join(''), 'i');

const sameSelection = (left, right) => left.length === right.length && left.every((item) => new Set(right).has(item));
const allSpecGlob = (files) => files.some((file) => /(?:^|\/)(?:\*\*\/)?\*\.spec\.mjs$/i.test(file));

/** Boundary specs in the same app/package root as a touched IO path. */
function affectedBoundarySpecs(changed, specs) {
  const io = pathList(changed).filter((file) => IO_PATH.test(file));
  if (!io.length) return [];
  const owner = (file) => {
    const parts = file.split('/');
    if (['examples', 'packages'].includes(parts[0])) return parts.slice(0, 2).join('/');
    if (['be', 'fe'].includes(parts[0])) return parts[0];
    return 'runtime';
  };
  const roots = new Set(io.map(owner));
  return specs.filter((spec) => BOUNDARY_SPEC.test(spec) && roots.has(owner(spec)));
}

/** Failed spec paths exposed by Node's spec reporter. */
function failedSpecFiles(output, root) {
  const files = [];
  for (const match of String(output).matchAll(/(?:test at |file:\/\/\/)([^\s):]+\.spec\.mjs)/g)) {
    let file = decodeURIComponent(match[1].replace(/^file:\/\//, ''));
    if (/^\/[A-Za-z]:\//.test(file)) file = file.slice(1);
    if (path.isAbsolute(file)) file = path.relative(root, file);
    files.push(file.replaceAll('\\', '/'));
  }
  return [...new Set(files)];
}

/** One node --test process, through the Node API owner. */
function runSpecs(root, files, concurrency, deps = {}) {
  if (deps.runTests) return deps.runTests({ root, files: [...files], concurrency });
  const args = [...PRELOADS.flatMap((file) => ['--import', `./${file}`]), '--test', `--test-concurrency=${concurrency}`, ...files];
  const result = runOutcome((deps.runNode ?? runNode)(args, { cwd: root, maxBuffer: 1024 * 1024 * 1024 }));
  return { ...result, failedFiles: result.ok ? [] : failedSpecFiles(`${result.stdout}\n${result.stderr}`, root) };
}

function tipOf(root, deps) {
  const tip = deps.tip ? deps.tip(root) : (deps.revParse ?? revParse)(root, 'HEAD');
  return String(tip ?? 'unknown').slice(0, 7);
}

function logFile(level, tip, deps) {
  const dir = deps.tempDir ?? tempRoot();
  return path.join(dir, level === 'L2' || level === 'L3' ? `preverify-${tip}.txt` : `test-${level}-${tip}.txt`);
}

function writeLog(file, text, deps, append = false) {
  const writer = deps.writeLog ?? ((target, value, add) => add ? fs.appendFileSync(target, value) : fs.writeFileSync(target, value));
  writer(file, text, append);
}

function selectedSpecs({ root, level, args, changed, allSpecs, deps }) {
  const explicit = pathList(args.spec);
  if (level === 'L4') return allSpecs;
  if (explicit.length) return explicit;
  const dependent = (deps.specsDependingOn ?? specsDependingOn)(root, changed, allSpecs);
  return level === 'L3' ? [...new Set([...dependent, ...(deps.affectedBoundarySpecs ?? affectedBoundarySpecs)(changed, allSpecs)])].sort(byCodeUnit) : dependent;
}

function runSummary(run) {
  const text = (run.stdout ?? '') + '\n' + (run.stderr ?? '');
  const count = (name) => {
    const matches = text.matchAll(new RegExp(String.raw`^[ \t]*(?:[ℹ#][ \t]*)?` + name + String.raw`[ \t]+(\d+)[ \t]*\r?$`, 'gim'));
    const match = [...matches].at(-1);
    return match ? Number(match[1]) : null;
  };
  const counts = run.counts ?? { tests: count('tests'), pass: count('pass'), fail: count('fail') };
  return ['tests', 'pass', 'fail'].every((key) => Number.isSafeInteger(counts[key]) && counts[key] >= 0)
    && counts.pass + counts.fail <= counts.tests ? counts : null;
}

const refuse = (level, message, extra = {}) => ladderRefusal({ schema: SCHEMA, level, message, ...extra });
const GATED_LEVELS = new Set(['L2', 'L3']);

// The refusal of a request whose level, concurrency, role or spec selection the ladder does not allow, or null.
function requestRefusal({ ctx, args, level }) {
  if (!level) return refuse(level, 'starci test run: --level is required (L1|L2|L3|L4)');
  if (level === 'L5') return refuse(level, 'starci test run: L5 is CI only and never runs locally');
  if (!['L1', 'L2', 'L3', 'L4'].includes(level)) return refuse(level, `starci test run: unsupported local level ${level}`);
  if (args.concurrency != null && (!Number.isSafeInteger(args.concurrency) || args.concurrency < 1)) {
    return refuse(level, 'starci test run: --concurrency must be a positive integer');
  }
  scopeFor(level);
  const role = ctx?.role ?? 'owner';
  if (GATED_LEVELS.has(level) && !['lead', 'coordinator', 'release', 'owner'].includes(role)) {
    return refuse(level, `starci test run: role ${role} may not run ${level}; a lead pre-verifies and a coordinator lands`);
  }
  const releaseCut = ctx?.env?.STARCI_RELEASE_CUT === '1' || (args['release-cut'] === true && ['release', 'owner'].includes(role));
  if (level === 'L4' && !releaseCut) {
    return refuse(level, 'starci test run: L4 runs only inside starci release cut (or release/owner with --release-cut)');
  }
  if (pathList(args.spec).length && level !== 'L1') return refuse(level, 'starci test run: --spec is available only at L1');
  if (level !== 'L4' && allSpecGlob(pathList(args.spec))) return refuse(level, 'starci test run: a glob of all specs is refused outside L4; narrow --spec');
  return null;
}

// L2/L3 run on a clean tree whose HEAD already holds `against`.
function mergeRefusal({ root, level, against, deps }) {
  if (!GATED_LEVELS.has(level)) return null;
  if (!cleanTree(root, deps)) return refuse(level, 'starci test run: REFUSED (worktree not clean: commit first)');
  const ancestor = deps.isAncestor ? deps.isAncestor(root, against, 'HEAD') : isAncestor(root, against, 'HEAD');
  return ancestor ? null : refuse(level, `starci test run: REFUSED (${against} is not merged into HEAD)`);
}

// The refusal of a selection that is too broad, too wide for L1 or empty for changed code, or null.
function selectionRefusal({ level, selected, allSpecs, changed }) {
  if (level !== 'L4' && sameSelection(selected, allSpecs) && allSpecs.length) {
    return refuse(level, 'starci test run: selecting every spec is refused outside L4; narrow the change or --spec', { scope: selected });
  }
  if (level === 'L1' && selected.length > 40) {
    return refuse(level, `starci test run: L1 selected ${selected.length} spec files (limit 40); narrow --changed or --spec`, { scope: selected });
  }
  if (!selected.length && changed.some((file) => CODE_FILE.test(file))) {
    return refuse(level, `starci test run: 0 specs selected for ${changed.length} changed code file(s); add or narrow --spec`);
  }
  return null;
}

const summaryUnusable = (counts) => !counts || counts.tests === 0 || counts.fail !== 0;

// The ladder check an L2/L3 run owes before its specs: the red result, or null.
async function gateCheck(r) {
  const { ctx, level, root, changed, selected, log, tip, deps } = r;
  const check = await (deps.checkRun ?? checkRun)({ ...ctx, cwd: root, args: { level, changed } }, deps);
  writeLog(log, `[check]\n${check.text ?? ''}\n`, deps);
  if (check.code === 0) return null;
  return ladderResult({ schema: SCHEMA, level, scope: selected, ok: false,
    findings: [{ kind: 'check', message: check.text ?? 'ladder check failed' }], log, tip, selected, changed, model: scopeFor(level).specs });
}

// The one serial re-run of the red spec files of an L2/L3 run.
async function retryRed(r, { red, decision }) {
  const { level, root, changed, selected, log, tip, deps } = r;
  const retry = await runSpecs(root, red, 1, deps);
  writeLog(log, `[red re-run concurrency=1]\n${retry.stdout ?? ''}${retry.stderr ?? ''}\n`, deps, true);
  const retryCounts = runSummary(retry);
  if (retry.ok && summaryUnusable(retryCounts)) return ladderResult({ schema: SCHEMA, level, scope: selected, ok: false,
    findings: [{ kind: 'spec-summary', files: red, message: 'the successful serial spec re-run did not report a nonempty passing test summary' }], log, tip, selected, changed, concurrency: decision, counts: retryCounts, model: scopeFor(level).specs });
  const flakes = retry.ok ? red : [];
  const findings = retry.ok
    ? [{ kind: 'flake', files: flakes, message: `${flakes.length} red spec file(s) passed on the one serial re-run` }]
    : [{ kind: 'spec-red', files: pathList(retry.failedFiles ?? red), message: 'red spec files failed again on the one serial re-run' }];
  return ladderResult({ schema: SCHEMA, level, scope: selected, ok: retry.ok, findings, log, tip, selected, changed,
    counts: retryCounts, flakes, concurrency: decision, model: scopeFor(level).specs });
}

// The spec run of the selection and what follows a red one.
async function runSelection(r) {
  const { args, level, root, changed, selected, log, tip, deps } = r;
  const decision = resolveTestConcurrency(args.concurrency, deps);
  const concurrency = decision.concurrency;
  writeLog(log, `[concurrency]\n${JSON.stringify(decision)}\n`, deps, true);
  const first = await runSpecs(root, selected, concurrency, deps);
  writeLog(log, `[specs concurrency=${concurrency}]\n${first.stdout ?? ''}${first.stderr ?? ''}\n`, deps, true);
  const firstCounts = runSummary(first);
  if (first.ok && summaryUnusable(firstCounts)) return ladderResult({ schema: SCHEMA, level, scope: selected, ok: false,
    findings: [{ kind: 'spec-summary', message: 'the successful spec process did not report a nonempty passing test summary' }], log, tip, selected, changed, concurrency: decision, counts: firstCounts, model: scopeFor(level).specs });
  if (first.ok) return ladderResult({ schema: SCHEMA, level, scope: selected, ok: true, findings: [], log, tip, selected, changed, concurrency: decision, counts: firstCounts, model: scopeFor(level).specs });
  const red = pathList(first.failedFiles ?? failedSpecFiles(`${first.stdout ?? ''}\n${first.stderr ?? ''}`, root)).filter((file) => selected.includes(file));
  if (!GATED_LEVELS.has(level) || !red.length) return ladderResult({ schema: SCHEMA, level, scope: selected, ok: false,
    findings: [{ kind: 'spec-red', files: red, message: red.length ? `${red.length} spec file(s) red` : 'the spec run was red but named no failing file' }], log, tip, selected, changed, concurrency: decision, counts: firstCounts, model: scopeFor(level).specs });
  return retryRed(r, { red, decision });
}

// One test run once the selection stands: the gate check (L2/L3), then the specs.
async function executeRun(r) {
  const { level, selected, changed, log, tip, deps } = r;
  if (GATED_LEVELS.has(level)) {
    const red = await gateCheck(r);
    if (red) return red;
  } else writeLog(log, '', deps);
  if (!selected.length) return ladderResult({ schema: SCHEMA, level, scope: [], ok: true, findings: [], log, tip, selected, changed, counts: { tests: 0, pass: 0, fail: 0 }, model: scopeFor(level).specs });
  return runSelection(r);
}

/** `starci test run`; all process, Git, lock and check edges are injectable through deps. */
export async function testRun(ctx, deps = {}) {
  const args = ctx?.args ?? {};
  const level = args.level;
  const root = path.resolve(ctx?.cwd ?? process.cwd(), args.root ?? '.');
  const refused = requestRefusal({ ctx, args, level });
  if (refused) return refused;
  const role = ctx?.role ?? 'owner';
  const against = String(args.against ?? 'main');
  const unmerged = mergeRefusal({ root, level, against, deps });
  if (unmerged) return unmerged;

  let changed = pathList(args.changed);
  if (!changed.length) changed = GATED_LEVELS.has(level) ? committedChanges(root, against, deps) : workingChanges(root, deps);
  const allSpecs = tracked(root, '*.spec.mjs', deps).sort(byCodeUnit);
  const selected = selectedSpecs({ root, level, args, changed, allSpecs, deps });
  const tooBroad = selectionRefusal({ level, selected, allSpecs, changed });
  if (tooBroad) return tooBroad;

  const tip = tipOf(root, deps);
  const run = { ctx, args, level, root, selected, changed, tip, log: logFile(level, tip, deps), deps };
  const execute = () => executeRun(run);
  if (level === 'L1') return await execute();
  const lock = deps.underHostLock ?? underHostLock;
  const held = await lock({ role, purpose: level === 'L4' ? 'test-l4' : 'test-l2', env: ctx?.env }, execute, deps);
  if (held?.ok === false) return ladderResult({ schema: SCHEMA, level, scope: selected, ok: false,
    findings: [{ kind: 'host-lock', message: held.reason === 'held' ? 'another heavy test run holds the host lock' : `host lock failed: ${held.reason ?? 'unknown reason'}` }],
    log: run.log, tip, selected, changed, model: scopeFor(level).specs });
  return held && Object.hasOwn(held, 'value') ? held.value : held;
}
