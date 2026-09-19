import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {parseYaml} from '../../../core/yaml.mjs';

/**
 * v7-6 writer: regenerates the stale evidence.yaml siblings in this lane's scope by invoking
 * scripts/example-evidence.mjs — the only tool whose provenance (actor: example-evidence,
 * tool: scripts/example-evidence.mjs) the layout accepts — and only for records whose probe pass
 * (v76-probe.mjs → v76-probe.json) showed every assertion exit 0 with at least one test actually
 * selected. Anything else is left exactly as found: the lane brief forbids marking evidence
 * `stale: true` to clear a refusal and forbids recording a proof that did not happen.
 *
 * Each original is copied to ex-testing/lint/scratch/v76-backup/<node>/evidence.yaml first, and a
 * record whose live run disagrees with the probe is restored from that backup.
 *
 * Usage: node v76-drive.mjs [--only <substring>] [--dry] [--allow-vacuous]
 */
const root = path.resolve('.');
const work = 'examples/todo-app-backend/.starciwork';
const workAbs = path.join(root, work);
const BE = path.join(root, 'examples/todo-app-backend');
const FE = path.join(root, 'examples/todo-app-frontend');
const backupDir = path.join(root, 'ex-testing/lint/scratch/v76-backup');
const PROBE = path.join(root, 'ex-testing/lint/scratch/v76-probe.json');
const argv = process.argv.slice(2);
const dry = argv.includes('--dry');
const allowVacuous = argv.includes('--allow-vacuous');
const onlyAt = argv.indexOf('--only');
const only = onlyAt >= 0 ? argv[onlyAt + 1] : null;

const inv = JSON.parse(fs.readFileSync(path.join(root, 'ex-testing/lint/scratch/v76-inv.json'), 'utf8'));
const targets = inv.files.filter(f => !f.staleFlag && (f.recordDigestMismatch || f.codeDigestMismatch));
const probe = fs.existsSync(PROBE) ? JSON.parse(fs.readFileSync(PROBE, 'utf8')).runs : {};

function cwdFor(node, command) {
  const recordDir = path.join(workAbs, node);
  if (/^node verify-captures\.mjs/.test(command)) return FE;
  if (/^cat /.test(command)) return recordDir;
  if (/^cd \.\.\/todo-app-frontend/.test(command)) return BE;
  if (/todo-app-frontend/.test(node)) return FE;
  return BE;
}
const rel = p => path.relative(root, p).replaceAll('\\', '/');
const keyOf = (node, command) => `${rel(cwdFor(node, command))}$$${command}`;

const run = {startedAt: new Date().toISOString(), records: []};
fs.mkdirSync(backupDir, {recursive: true});

for (const t of targets) {
  if (only && !t.node.includes(only)) continue;
  // A record lane may have repaired the dead command its evidence still carries (v7-1 replaced
  // `npm run test:e2e -- tasks/complete` with the real spec path and handed the re-capture to this
  // lane). Where the record now declares a command for the same assertion id, the record's current
  // declaration is the proof to run; the substitution is reported.
  let declared = {};
  try {
    const recDoc = parseYaml(fs.readFileSync(path.join(workAbs, t.node, 'index.yaml'), 'utf8'));
    for (const [key, block] of Object.entries(recDoc?.requiresProof ?? {})) {
      if (block && typeof block.command === 'string') declared[key] = block.command;
    }
  } catch { /* a record that cannot be parsed simply declares nothing; its evidence is left alone */ }
  const assertions = t.assertions.map(a => {
    const replacement = declared[a.id];
    if (replacement && replacement !== a.command) return {...a, command: replacement, substitutedFrom: a.command};
    return a;
  });
  const entry = {node: t.node, id: t.id, state: t.state, cwd: rel(cwdFor(t.node, assertions[0]?.command ?? '')), assertions: [], written: false};
  const blockers = [];
  for (const a of assertions) {
    const p = probe[keyOf(t.node, a.command)];
    if (!p) { blockers.push(`${a.id}: not probed (no measurement on record)`); entry.assertions.push({id: a.id, probed: false}); continue; }
    // A jest `-t` filter, a jest path run or a vitest run that selected no test is not a proof, even
    // though all three exit 0.
    const vacuous = p.exit === 0 && !p.passed && !allowVacuous && (Boolean(p.tests) || Boolean(p.vitest) || / -t /.test(a.command));
    entry.assertions.push({id: a.id, command: a.command, substitutedFrom: a.substitutedFrom ?? null, exit: p.exit, passed: p.passed, failed: p.failed, skipped: p.skipped, total: p.total, tests: p.tests, vitest: p.vitest, tail: p.tail?.slice(0, 4)});
    if (p.exit !== 0) blockers.push(`${a.id}: exited ${p.exit}`);
    else if (vacuous) blockers.push(`${a.id}: exited 0 but selected no test (${p.tests ?? p.vitest ?? 'no test summary'}) — a vacuous run is not a proof`);
  }
  if (blockers.length) {
    entry.skippedReason = blockers;
    run.records.push(entry);
    console.log(`SKIP  ${t.node} — ${blockers[0]}${blockers.length > 1 ? ` (+${blockers.length - 1} more)` : ''}`);
    continue;
  }
  if (dry) { entry.dry = true; run.records.push(entry); console.log(`READY ${t.node}`); continue; }

  const evidenceFile = path.join(workAbs, t.node, 'evidence.yaml');
  const backup = path.join(backupDir, t.node);
  fs.mkdirSync(backup, {recursive: true});
  fs.copyFileSync(evidenceFile, path.join(backup, 'evidence.yaml'));

  const args = [path.join(root, 'scripts/example-evidence.mjs'), '--work', work, '--record', t.id, '--cwd', entry.cwd];
  for (const a of assertions) args.push('--assert', `${a.id}=${a.command}`);
  let out = '', code = null;
  try {
    out = execFileSync(process.execPath, args, {cwd: root, encoding: 'utf8', stdio: 'pipe', timeout: 1800000, maxBuffer: 64 * 1024 * 1024});
    code = 0;
  } catch (error) {
    code = typeof error?.status === 'number' ? error.status : 1;
    out = `${error?.stdout ?? ''}${error?.stderr ?? ''}${error?.message ?? ''}`;
  }
  entry.toolExit = code;
  entry.toolOut = out.trim();
  if (code === 0) {
    entry.written = true;
    console.log(`WROTE ${t.node}`);
  } else {
    fs.copyFileSync(path.join(backup, 'evidence.yaml'), evidenceFile);
    entry.restored = true;
    console.log(`FAILED ${t.node} (tool exit ${code}) — original restored`);
  }
  run.records.push(entry);
}
run.finishedAt = new Date().toISOString();
run.summary = {
  considered: run.records.length,
  written: run.records.filter(r => r.written).length,
  failedRestored: run.records.filter(r => r.restored).length,
  skipped: run.records.filter(r => r.skippedReason).length,
  dryReady: run.records.filter(r => r.dry).length,
};
fs.writeFileSync(path.join(root, 'ex-testing/lint/scratch/v76-run.json'), JSON.stringify(run, null, 1));
console.log(`summary ${JSON.stringify(run.summary)}`);
