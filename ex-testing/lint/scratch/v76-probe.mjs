import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

/**
 * v7-6 probe: run every assertion command of every stale evidence.yaml in this lane's scope once, with
 * its output captured, so the lane can tell a real pass from a vacuous one before anything is written.
 *
 * Why this exists: on this host `npx jest -t "<filter>"` exits 0 even when the filter selects nothing
 * ("Tests: 701 skipped, 701 total"), so exit code alone cannot tell a proof from a no-op. The probe
 * therefore records the jest/vitest summary line next to the exit code. Writes nothing into .starciwork.
 *
 * Usage: node v76-probe.mjs [--only <substring>] [--limit N] [--skip-heavy]
 */
const root = path.resolve('.');
const BE = path.join(root, 'examples/todo-app-backend');
const FE = path.join(root, 'examples/todo-app-frontend');
const workAbs = path.join(root, 'examples/todo-app-backend/.starciwork');
const OUT = path.join(root, 'ex-testing/lint/scratch/v76-probe.json');
const LOGDIR = path.join(root, 'ex-testing/lint/scratch/v76-probelogs');

const argv = process.argv.slice(2);
const onlyAt = argv.indexOf('--only');
const only = onlyAt >= 0 ? argv[onlyAt + 1] : null;
const limitAt = argv.indexOf('--limit');
const limit = limitAt >= 0 ? Number(argv[limitAt + 1]) : Infinity;
const skipHeavy = argv.includes('--skip-heavy');

const HEAVY = [/npm run build/, /npx next build/, /assets\/capture\.mjs/, /architecture check/, /npx tsc --noEmit/, /npx eslint/, /npm run uat:typecheck/];

const inv = JSON.parse(fs.readFileSync(path.join(root, 'ex-testing/lint/scratch/v76-inv.json'), 'utf8'));
let targets = inv.files.filter(f => !f.staleFlag && (f.recordDigestMismatch || f.codeDigestMismatch));

// --cwd <rel> --command <cmd> [--as <id>] probes one hand-chosen command (e.g. the corrected
// requiresProof.e2e.command a record lane just wrote) into the same cache the writer reads.
let manualCwd = null;
const cwdAt = argv.indexOf('--cwd');
const cmdAt = argv.indexOf('--command');
if (cmdAt >= 0) {
  if (cwdAt < 0) throw new Error('--command needs --cwd');
  const asAt = argv.indexOf('--as');
  targets = [{node: `__manual__/${path.basename(argv[cwdAt + 1])}`, state: 'manual', assertions: [{id: asAt >= 0 ? argv[asAt + 1] : 'probe', command: argv[cmdAt + 1]}]}];
  manualCwd = path.resolve(root, argv[cwdAt + 1]);
}

function cwdFor(node, command) {
  if (manualCwd) return manualCwd;
  const recordDir = path.join(workAbs, node);
  if (/^node verify-captures\.mjs/.test(command)) return FE;
  if (/^cat /.test(command)) return recordDir;
  if (/^cd \.\.\/todo-app-frontend/.test(command)) return BE;
  if (/todo-app-frontend/.test(node)) return FE;
  return BE;
}

function summarise(text) {
  const lines = String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const tests = lines.filter(l => /^Tests:/.test(l)).join(' | ') || null;
  const suites = lines.filter(l => /^Test Suites:/.test(l)).join(' | ') || null;
  const vitest = lines.filter(l => /^Tests\s+\d/.test(l) || /^Test Files\s+/.test(l)).join(' | ') || null;
  const num = (source, label) => Number((String(source ?? '').match(new RegExp(`(\\d+) ${label}`)) ?? [])[1] ?? 0);
  const src = tests ?? vitest;
  return {
    tests, suites, vitest,
    passed: num(src, 'passed'), failed: num(src, 'failed'), skipped: num(src, 'skipped'), total: num(src, 'total'),
    tail: lines.slice(-14),
  };
}

const done = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {runs: {}};
fs.mkdirSync(LOGDIR, {recursive: true});
let count = 0;

for (const t of targets) {
  if (only && !t.node.includes(only)) continue;
  for (const a of t.assertions) {
    const key = `${path.relative(root, cwdFor(t.node, a.command)).replaceAll('\\', '/')}$$${a.command}`;
    if (done.runs[key] && !done.runs[key].stale) continue;
    if (count >= limit) { console.log('LIMIT reached'); fs.writeFileSync(OUT, JSON.stringify(done, null, 1)); process.exit(0); }
    if (skipHeavy && HEAVY.some(re => re.test(a.command))) { console.log(`HEAVY-SKIP ${t.node} ${a.id}`); continue; }
    const cwd = cwdFor(t.node, a.command);
    const started = new Date();
    // jest and vitest both print their summary on stderr, so stdout alone would hide the whole
    // "Tests: 0 passed, 701 skipped" evidence that distinguishes a proof from a no-op.
    const spawned = spawnSync(a.command, {cwd, shell: true, encoding: 'utf8', timeout: 1500000, maxBuffer: 64 * 1024 * 1024});
    const code = typeof spawned.status === 'number' ? spawned.status : 1;
    const out = `${spawned.stdout ?? ''}\n${spawned.stderr ?? ''}\n${spawned.error ? `${spawned.error.killed ? 'KILLED(timeout) ' : ''}${spawned.error.message}` : ''}`;
    const s = summarise(out);
    done.runs[key] = {cwd: path.relative(root, cwd).replaceAll('\\', '/'), command: a.command, exit: code, seconds: Math.round((Date.now() - started.getTime()) / 1000), ranAt: started.toISOString(), ...s};
    const logFile = path.join(LOGDIR, `${count.toString().padStart(3, '0')}-${key.replace(/[^\w.-]+/g, '_').slice(-90)}.log`);
    fs.writeFileSync(logFile, `$ ${a.command}\n(cwd ${cwd})\nexit ${code}\n\n${out}`);
    count += 1;
    console.log(`[${count}] exit=${code} ${String(s.passed).padStart(3)} matched ${done.runs[key].seconds}s ${t.node} :: ${a.id}`);
    fs.writeFileSync(OUT, JSON.stringify(done, null, 1));
  }
}
fs.writeFileSync(OUT, JSON.stringify(done, null, 1));
console.log(`probe complete: ${count} command runs this pass, ${Object.keys(done.runs).length} total cached`);
