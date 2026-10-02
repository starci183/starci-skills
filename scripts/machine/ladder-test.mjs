// ladder-test.mjs - `starci test run`: targeted/dependent/full spec execution with the release and host-lock policy.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isAncestor } from '../api/git/is-ancestor.mjs';
import { revParse } from '../api/git/rev-parse.mjs';
import { runNode } from '../api/node/run-node.mjs';
import { specsDependingOn } from '../lib/spec-deps.mjs';
import { underHostLock } from './verb-lock.mjs';
import { checkRun } from './ladder-check.mjs';
import { cleanTree, committedChanges, tracked, workingChanges, runOutcome } from './ladder-select.mjs';
import { ladderRefusal, ladderResult, pathList, scopeFor } from './test-ladder.mjs';

const SCHEMA = 'starci/test-run@1';
const PRELOADS = Object.freeze(['tests/setup/low-priority.mjs', 'tests/setup/isolated-temp.mjs', 'tests/setup/isolated-registry.mjs']);
const CODE_FILE = /\.(?:[cm]?[jt]sx?|json)$/i;
const BOUNDARY_SPEC = /(?:(?:^|\/)(?:integration|contract|e2e)(?:\/|[-.])|[.-](?:integration|contract|e2e)[.-])/i;
const IO_PATH = /(?:^|\/)(?:db|database|queue|kafka|webhooks?|sagas?|jobs?|events?|contracts?)(?:\/|[-.])/i;

const sameSelection = (left, right) => left.length === right.length && left.every((item) => new Set(right).has(item));
const allSpecGlob = (files) => files.some((file) => /(?:^|\/)(?:\*\*\/)?\*\.spec\.mjs$/i.test(file));

/** Boundary specs in the same app/package root as a touched IO path. */
export function affectedBoundarySpecs(changed, specs) {
  const io = pathList(changed).filter((file) => IO_PATH.test(file));
  if (!io.length) return [];
  const owner = (file) => {
    const parts = file.split('/');
    return ['examples', 'packages'].includes(parts[0]) ? parts.slice(0, 2).join('/') : ['be', 'fe'].includes(parts[0]) ? parts[0] : 'runtime';
  };
  const roots = new Set(io.map(owner));
  return specs.filter((spec) => BOUNDARY_SPEC.test(spec) && roots.has(owner(spec)));
}

/** Failed spec paths exposed by Node's spec reporter. */
export function failedSpecFiles(output, root) {
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
  const dir = deps.tempDir ?? os.tmpdir();
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
  return level === 'L3' ? [...new Set([...dependent, ...(deps.affectedBoundarySpecs ?? affectedBoundarySpecs)(changed, allSpecs)])].sort() : dependent;
}

function runSummary(run) {
  const text = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
  const count = (name) => Number(new RegExp(`(?:^|\\n)\\s*(?:ℹ\\s*)?${name}\\s+(\\d+)`, 'i').exec(text)?.[1] ?? 0);
  return run.counts ?? { tests: count('tests'), pass: count('pass'), fail: count('fail') };
}

/** `starci test run`; all process, Git, lock and check edges are injectable through deps. */
export async function testRun(ctx, deps = {}) {
  const args = ctx?.args ?? {};
  const level = args.level;
  const root = path.resolve(ctx?.cwd ?? process.cwd(), args.root ?? '.');
  if (!level) return ladderRefusal({ schema: SCHEMA, level, message: 'starci test run: --level is required (L1|L2|L3|L4)' });
  if (level === 'L5') return ladderRefusal({ schema: SCHEMA, level, message: 'starci test run: L5 is CI only and never runs locally' });
  if (!['L1', 'L2', 'L3', 'L4'].includes(level)) return ladderRefusal({ schema: SCHEMA, level, message: `starci test run: unsupported local level ${level}` });
  scopeFor(level);

  const role = ctx?.role ?? 'owner';
  if (['L2', 'L3'].includes(level) && !['lead', 'coordinator', 'release', 'owner'].includes(role)) {
    return ladderRefusal({ schema: SCHEMA, level, message: `starci test run: role ${role} may not run ${level}; a lead pre-verifies and a coordinator lands` });
  }
  const releaseCut = ctx?.env?.STARCI_RELEASE_CUT === '1' || (args['release-cut'] === true && ['release', 'owner'].includes(role));
  if (level === 'L4' && !releaseCut) {
    return ladderRefusal({ schema: SCHEMA, level, message: 'starci test run: L4 runs only inside starci release cut (or release/owner with --release-cut)' });
  }
  if (pathList(args.spec).length && level !== 'L1') return ladderRefusal({ schema: SCHEMA, level, message: 'starci test run: --spec is available only at L1' });
  if (level !== 'L4' && allSpecGlob(pathList(args.spec))) return ladderRefusal({ schema: SCHEMA, level, message: 'starci test run: a glob of all specs is refused outside L4; narrow --spec' });

  const against = String(args.against ?? 'main');
  if (['L2', 'L3'].includes(level)) {
    if (!cleanTree(root, deps)) return ladderRefusal({ schema: SCHEMA, level, message: 'starci test run: REFUSED (worktree not clean: commit first)' });
    const ancestor = deps.isAncestor ? deps.isAncestor(root, against, 'HEAD') : isAncestor(root, against, 'HEAD');
    if (!ancestor) return ladderRefusal({ schema: SCHEMA, level, message: `starci test run: REFUSED (${against} is not merged into HEAD)` });
  }

  const changed = pathList(args.changed).length ? pathList(args.changed)
    : ['L2', 'L3'].includes(level) ? committedChanges(root, against, deps) : workingChanges(root, deps);
  const allSpecs = tracked(root, '*.spec.mjs', deps).sort();
  const selected = selectedSpecs({ root, level, args, changed, allSpecs, deps });
  if (level !== 'L4' && sameSelection(selected, allSpecs) && allSpecs.length) {
    return ladderRefusal({ schema: SCHEMA, level, scope: selected, message: 'starci test run: selecting every spec is refused outside L4; narrow the change or --spec' });
  }
  if (level === 'L1' && selected.length > 40) {
    return ladderRefusal({ schema: SCHEMA, level, scope: selected, message: `starci test run: L1 selected ${selected.length} spec files (limit 40); narrow --changed or --spec` });
  }
  if (!selected.length && changed.some((file) => CODE_FILE.test(file))) {
    return ladderRefusal({ schema: SCHEMA, level, message: `starci test run: 0 specs selected for ${changed.length} changed code file(s); add or narrow --spec` });
  }

  const tip = tipOf(root, deps);
  const log = logFile(level, tip, deps);
  const execute = async () => {
    if (['L2', 'L3'].includes(level)) {
      const check = await (deps.checkRun ?? checkRun)({ ...ctx, cwd: root, args: { level, changed } }, deps);
      writeLog(log, `[check]\n${check.text ?? ''}\n`, deps);
      if (check.code !== 0) return ladderResult({ schema: SCHEMA, level, scope: selected, ok: false,
        findings: [{ kind: 'check', message: check.text ?? 'ladder check failed' }], log, tip, selected, changed, model: scopeFor(level).specs });
    } else writeLog(log, '', deps);

    if (!selected.length) return ladderResult({ schema: SCHEMA, level, scope: [], ok: true, findings: [], log, tip, selected, changed, counts: { tests: 0, pass: 0, fail: 0 }, model: scopeFor(level).specs });
    const concurrency = Math.max(1, Number(args.concurrency ?? 4) || 4);
    const first = await runSpecs(root, selected, concurrency, deps);
    writeLog(log, `[specs concurrency=${concurrency}]\n${first.stdout ?? ''}${first.stderr ?? ''}\n`, deps, true);
    if (first.ok) return ladderResult({ schema: SCHEMA, level, scope: selected, ok: true, findings: [], log, tip, selected, changed, counts: runSummary(first), model: scopeFor(level).specs });

    const red = pathList(first.failedFiles ?? failedSpecFiles(`${first.stdout ?? ''}\n${first.stderr ?? ''}`, root)).filter((file) => selected.includes(file));
    if (!['L2', 'L3'].includes(level) || !red.length) return ladderResult({ schema: SCHEMA, level, scope: selected, ok: false,
      findings: [{ kind: 'spec-red', files: red, message: red.length ? `${red.length} spec file(s) red` : 'the spec run was red but named no failing file' }], log, tip, selected, changed, counts: runSummary(first), model: scopeFor(level).specs });
    const retry = await runSpecs(root, red, 1, deps);
    writeLog(log, `[red re-run concurrency=1]\n${retry.stdout ?? ''}${retry.stderr ?? ''}\n`, deps, true);
    const flakes = retry.ok ? red : [];
    const findings = retry.ok
      ? [{ kind: 'flake', files: flakes, message: `${flakes.length} red spec file(s) passed on the one serial re-run` }]
      : [{ kind: 'spec-red', files: pathList(retry.failedFiles ?? red), message: 'red spec files failed again on the one serial re-run' }];
    return ladderResult({ schema: SCHEMA, level, scope: selected, ok: retry.ok, findings, log, tip, selected, changed,
      counts: runSummary(retry), flakes, model: scopeFor(level).specs });
  };

  if (['L2', 'L3', 'L4'].includes(level)) {
    const lock = deps.underHostLock ?? underHostLock;
    const held = await lock({ role, purpose: level === 'L4' ? 'test-l4' : 'test-l2', env: ctx?.env }, execute, deps);
    if (held?.ok === false) return ladderResult({ schema: SCHEMA, level, scope: selected, ok: false,
      findings: [{ kind: 'host-lock', message: held.reason === 'held' ? 'another heavy test run holds the host lock' : `host lock failed: ${held.reason ?? 'unknown reason'}` }],
      log, tip, selected, changed, model: scopeFor(level).specs });
    return held && Object.hasOwn(held, 'value') ? held.value : held;
  }
  return await execute();
}
