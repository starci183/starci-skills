import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openMachine, openMachineReader } from '../../engine/machine-db.mjs';
import { openLedger, openLedgerReader, ledgerIdForRepo } from '../../engine/ledger-db.mjs';
import { redactText } from '../../scripts/lib/redact.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const canonical = p => path.resolve(p).replaceAll('\\','/').toLowerCase();
function safeGeneratedTarget(parent, name) {
  const expectedParent = path.resolve(parent);
  const target = path.resolve(expectedParent, name);
  if (canonical(path.dirname(target)) !== canonical(expectedParent) || path.basename(target) !== name) throw Error('Unsafe generated output path');
  if (canonical(fs.realpathSync.native(expectedParent)) !== canonical(expectedParent)) throw Error('Generated output parent is a link');
  if (fs.existsSync(target)) {
    if (fs.lstatSync(target).isSymbolicLink() || canonical(fs.realpathSync.native(target)) !== canonical(target)) throw Error('Generated output target is a link');
  }
  return target;
}
const root = safeGeneratedTarget(here, 'seed');
fs.rmSync(root, { recursive: true, force: true });
fs.mkdirSync(root, { recursive: true });
const fixedNow = 1790550000000;
const now = () => fixedNow;
const artifactRoot = safeGeneratedTarget('D:/starci-tmp', 'ui-seed-artifacts');
fs.rmSync(artifactRoot, { recursive:true, force:true });
fs.mkdirSync(artifactRoot, { recursive:true });
process.env.STARCI_ARTIFACT_ROOT = artifactRoot;
process.env.STARCI_TEST_MACHINE_FILE = path.join(root, 'machine.sqlite');
process.env.STARCI_PROJECTS_ROOT = path.join(root, 'projects');

const secrets = [
  ['ghp', '_', 'F'.repeat(36)],
  ['eyJhbGciOiJIUzI1NiJ9', '.', 'eyJzdWIiOiJmYWtlIn0', '.', 'FAKESIGNATURE'],
  ['postgres:', '//', 'u:p@h/db'],
  ['-----BEGIN ', 'PRIVATE KEY-----'],
  ['OPENAI_API_', 'KEY=sk-', 'testFAKESTARCISEED'],
].map(parts => parts.join(''));
fs.writeFileSync(path.join(root, 'planted-secrets.txt'), secrets.join('\n') + '\n');
const fakeSha = n => n.toString(16).padStart(64, '0');
const trace = n => n.toString(16).padStart(32, '0');
const span = n => n.toString(16).padStart(16, '0');
const machine = openMachine({ file: process.env.STARCI_TEST_MACHINE_FILE, now });
const runtimes = [];

function makeRuntime(name, n) {
  const repoRoot = path.join(root, 'repositories', name);
  const id = ledgerIdForRepo(repoRoot);
  const file = path.join(root, 'projects', id, 'runtime.sqlite');
  const ledger = openLedger({ file, repoRoot, product: 'seed', now, machine });
  machine.registerLedger({ ledgerId: id, name, repoRoot, file, product: 'seed', schemaVersion: 1 });
  machine.upsertRepository({ repoRoot, name, role: 'backend', ledgerId: id, defaultBranch: 'main' });
  runtimes.push({ name, id, file, ledger, repoRoot });
  return runtimes.at(-1);
}

function workflow(runtime, id, title, phase = 'running', n = 1) {
  const { ledger } = runtime;
  ledger.write.createWorkflow({ workflowId: id, phase: 'queued', title, displayName: title, traceId: trace(n), allowedParallel: 3, at: fixedNow - 3600000 });
  ledger.write.insertGoal({ workflowId: id, revision: 1, goalIdentity: `goal-${id}`, markdown: `Deliver ${title}`, goal: {title}, approvedBy: 'owner', createdAt: fixedNow - 3600000 });
  if (phase !== 'queued') ledger.write.changeWorkflowPhase({ workflowId: id, to: 'running', by: 'kernel', reason: 'seed', at: fixedNow - 3500000 });
  if (phase !== 'queued' && phase !== 'running') ledger.write.changeWorkflowPhase({ workflowId: id, to: phase, by: 'owner', reason: 'seed', at: fixedNow - 100000 });
}

try {
  const a = makeRuntime('nivo-backend', 1);
  const b = makeRuntime('starci-next', 2);
  workflow(a, 'wf-stuck', 'Blocked delivery', 'running', 1);
  workflow(a, 'wf-under-dispatched', 'Ready work', 'running', 2);
  workflow(a, 'wf-paused', 'Paused delivery', 'paused', 3);
  workflow(a, 'wf-stopped', 'Stopped delivery', 'stopped', 4);
  workflow(a, 'wf-done', 'Finished delivery', 'finished', 5);
  workflow(b, 'wf-secondary', 'Second project', 'running', 6);

  const db = a.ledger;
  db.write.createUnit({ workflowId: 'wf-stuck', unitId: 'unit-failed', opId: 'code.refactor', subjectKey: 'source-a', goalRevision: 1, title: 'Compile source', createdAt: fixedNow - 3400000 });
  db.write.createUnit({ workflowId: 'wf-stuck', unitId: 'unit-blocked', opId: 'interface.implement', subjectKey: 'screen-b', goalRevision: 1, title: 'Blocked screen', createdAt: fixedNow - 3400000 });
  db.write.addUnitEdge({ workflowId: 'wf-stuck', fromUnit: 'unit-failed', toUnit: 'unit-blocked', kind: 'after', source: 'seed', createdAt: fixedNow - 3300000 });
  db.write.createUnit({ workflowId: 'wf-under-dispatched', unitId: 'unit-ready', opId: 'code.refactor', subjectKey: 'ready', goalRevision: 1, title: 'Ready to dispatch', createdAt: fixedNow - 3300000 });
  db.write.enqueueJob({ jobId: 'job-ready', workflowId: 'wf-under-dispatched', unitId: 'unit-ready', opId: 'code.refactor', createdAt: fixedNow - 3200000 });
  db.write.setJobStatus({ jobId: 'job-ready', to: 'ready', at: fixedNow - 3100000 });
  db.write.createUnit({ workflowId: 'wf-under-dispatched', unitId: 'unit-active', opId: 'code.refactor', subjectKey: 'active', goalRevision: 1, title: 'Active dispatch', createdAt: fixedNow - 3300000 });
  db.write.createUnit({ workflowId: 'wf-under-dispatched', unitId: 'unit-done', opId: 'code.refactor', subjectKey: 'completed', goalRevision: 1, title: 'Recently completed work', createdAt: fixedNow - 3300000 });
  db.write.setUnitState({ workflowId: 'wf-under-dispatched', unitId: 'unit-done', to: 'done', at: Date.now() });
  db.write.enqueueJob({ jobId: 'job-active', workflowId: 'wf-under-dispatched', unitId: 'unit-active', opId: 'code.refactor', createdAt: fixedNow - 3200000 });
  db.write.setJobStatus({ jobId: 'job-active', to: 'ready', at: fixedNow - 3100000 });
  db.write.setJobStatus({ jobId: 'job-active', to: 'leased', leaseToken: 'seed-active-lease', at: fixedNow - 3000000 });
  db.write.setJobStatus({ jobId: 'job-active', to: 'running', at: fixedNow - 2900000 });
  db.write.setUnitState({ workflowId: 'wf-under-dispatched', unitId: 'unit-active', to: 'running', at: fixedNow - 2900000 });
  db.write.enqueueJob({ jobId: 'job-failed', workflowId: 'wf-stuck', unitId: 'unit-failed', opId: 'code.refactor', createdAt: fixedNow - 3200000 });
  db.write.setJobStatus({ jobId: 'job-failed', to: 'ready', at: fixedNow - 3100000 });
  db.write.setJobStatus({ jobId: 'job-failed', to: 'leased', leaseToken: 'seed-lease', at: fixedNow - 3000000 });
  const attempt = db.write.startAttempt({ workflowId: 'wf-stuck', jobId: 'job-failed', dispatchId: 'dispatch-failed', spanId: span(1), agent: 'codex', provider: 'openai', model: 'seed-model', routedBy: 'route', dispatchedAt: fixedNow - 2900000, at: fixedNow - 2900000 });
  db.write.setJobStatus({ jobId: 'job-failed', to: 'running', at: fixedNow - 2900000 });
  db.write.setUnitState({ workflowId: 'wf-stuck', unitId: 'unit-failed', to: 'running', at: fixedNow - 2900000 });
  db.write.createUnit({ workflowId:'wf-stuck', unitId:'unit-missing-transcript', opId:'code.refactor', subjectKey:'missing-transcript', goalRevision:1, title:'Missing terminal capture', createdAt:fixedNow - 2800000 });
  db.write.enqueueJob({ jobId:'job-missing-transcript', workflowId:'wf-stuck', unitId:'unit-missing-transcript', opId:'code.refactor', createdAt:fixedNow - 2700000 });
  db.write.setJobStatus({ jobId:'job-missing-transcript', to:'ready', at:fixedNow - 2600000 });
  db.write.setJobStatus({ jobId:'job-missing-transcript', to:'leased', leaseToken:'seed-missing-lease', at:fixedNow - 2500000 });
  const missing = db.write.startAttempt({ workflowId:'wf-stuck', jobId:'job-missing-transcript', dispatchId:'dispatch-missing-transcript', spanId:span(3), agent:'codex', provider:'codex', model:'seed-model', routedBy:'route', dispatchedAt:fixedNow - 2400000, at:fixedNow - 2400000 });
  db.write.updateAttempt({ attemptId:missing.attempt_id, terminalClosedAt:fixedNow - 600000, endState:'worker-dead', at:fixedNow - 600000 });
  const outputText = `tsc-app failed: ${secrets[0]}`;
  const output = db.write.storeBlob({ content: Buffer.from(redactText(outputText)), mediaType: 'text/plain', redaction: 'v1', createdAt: fixedNow });
  // A legacy unmarked text blob exercises the server's defensive stream redaction.
  const unmarked = db.write.storeBlob({ content: Buffer.from(outputText), mediaType: 'text/plain', createdAt: fixedNow });
  const stderr = db.write.storeBlob({ content: Buffer.from(redactText(`compile error ${secrets[1]}`)), mediaType: 'text/plain', redaction: 'v1', createdAt: fixedNow });
  const transcript = db.write.storeBlob({ content: Buffer.from(redactText(`Agent began work\n${secrets[2]}\nCompile failed`)), mediaType: 'text/plain', redaction: 'v1', createdAt: fixedNow });
  for (let i = 0; i < 3; i++) db.write.recordTranscriptSnapshot({ attemptId: attempt.attempt_id, sha256: db.write.storeBlob({content: Buffer.from(redactText(`Snapshot ${i}\n${secrets[0]}`)), mediaType:'text/plain', redaction:'v1', createdAt:fixedNow + i }).sha256, lines: 2, bytes: 24, at: fixedNow - 2400000 + i * 60000 });
  db.write.setAttemptTranscript({ attemptId: attempt.attempt_id, transcriptSha: transcript.sha256, at: fixedNow - 100000 });
  db.write.fileReport({ attemptId: attempt.attempt_id, outcome: 'done', report: {summary: `Claimed done ${secrets[3]}`}, createdAt: fixedNow - 200000 });
  db.write.recordCheckRun({ attemptId: attempt.attempt_id, name: 'tsc-app', phase: 'after', runner: 'settler', spanId:span(4), status: 'fail', exitCode: 2, stdoutSha: output.sha256, stderrSha: stderr.sha256, startedAt: fixedNow - 180000, finishedAt: fixedNow - 179000, createdAt: fixedNow - 180000 });
  db.write.recordCheckRun({ attemptId: attempt.attempt_id, name: 'lint', phase: 'after', runner: 'settler', spanId:span(5), status: 'fail', exitCode: 1, stdoutSha: output.sha256, stderrSha: stderr.sha256, startedAt: fixedNow - 178000, finishedAt: fixedNow - 177000, createdAt: fixedNow - 178000 });
  db.write.updateAttempt({ attemptId: attempt.attempt_id, verdict: 'fail', settledBy: 'settler', failureClass: 'check-red', endState: 'settled', settledAt: fixedNow - 170000, terminalClosedAt: fixedNow - 160000, at: fixedNow - 170000 });
  db.write.recordArtifact({ attemptId: attempt.attempt_id, name: 'compile-output.txt', sha256: output.sha256, role: 'check-output', kind: 'log', createdAt: fixedNow - 180000 });
  console.log(`Unmarked text blob for read-side redaction: ${unmarked.sha256}`);
  db.write.appendLog({ workflowId: 'wf-stuck', actor: 'check', level: 'error', kind: 'tsc-app', msg: `${secrets[4]} compilation failed`, attemptId: attempt.attempt_id, at: fixedNow - 175000 });

  const di = db.write.openDecisionItem({ diId: 'di-overdue', idempotencyKey: 'settle:unit-failed:seed:one', keyParts: {kind:'settle',entity:'unit-failed',signature:'seed',head:'one'}, workflowId:'wf-stuck', kind:'settle-nongreen', decider:'kernel', summary:`Review failure ${secrets[0]}`, openedBy:'job-controller', dueAt: fixedNow - 10000, at: fixedNow - 1800000 });
  db.write.updateDecisionItem({ diId: di.di_id, status:'escalated', escalations:1, escalateTo:'supervisor', at: fixedNow - 500000 });
  db.write.recordDecision({ decisionId:'dec-seed', workflowId:'wf-stuck', spanId:span(2), decider:'kernel', diId:di.di_id, subjectType:'unit', subjectId:'unit-failed', choice:'retry', rationale:'Compilation failed', result:{status:'revert'}, decidedAt: fixedNow - 100000 });
  db.write.openIncident({ incidentId:'inc-credential', workflowId:'wf-stuck', kind:'credential-missing', owner:'owner', detail:'Credential required', at: fixedNow - 400000 });
  const ownerDi = db.write.openDecisionItem({ diId:'di-owner', idempotencyKey:'credential:workflow:seed:one', keyParts:{kind:'credential',entity:'workflow',signature:'seed',head:'one'}, workflowId:'wf-stuck', kind:'credential-missing', decider:'owner', summary:'Credential approval needed', openedBy:'kernel', at:fixedNow - 390000 });
  machine.upsertAsk({ askId:'ask-credential', ledgerId:a.id, workflowId:'wf-stuck', diId:ownerDi.di_id, channel:'telegram', question:`Provide credential ${secrets[4]}`, state:'open' });
  db.write.appendEvent({ eventId:'event-escalated', workflowId:'wf-stuck', entityType:'decision', entityId:di.di_id, kind:'decision-escalated', payload:{from:'kernel',to:'supervisor'}, createdAt:fixedNow - 490000 });
  machine.supEvent({ eventId:'sup-event-escalated', entityType:'decision', entityId:di.di_id, kind:'decision-escalated', payload:{from:'kernel',to:'supervisor'}, at:fixedNow - 480000 });

  machine.log({ actor:'reconciler', controller:'job', kind:'tsc-app.failed', msg:'Compilation failed', data:{raw:secrets[1]}, ledgerId:a.id, workflowId:'wf-stuck', at:fixedNow - 150000 });
  machine.setControllerMode({ controller:'host', mode:'active', by:'seed', reason:'show active mode' });
  const sla = machine.openSlaEpisode({ entity:'unit:unit-failed', state:'running', code:'WORKER_SILENT', severity:'critical', ledgerId:a.id, workflowId:'wf-stuck', slaMs:120000, enteredAt:fixedNow - 600000 });
  machine.markSlaViolated(sla);
  machine.recordViolation({ code:'WORKER_SILENT', severity:'critical', entity:'unit:unit-failed', ledgerId:a.id, workflowId:'wf-stuck', episodeId:sla, detail:{cause:'silent'} });
  machine.upsertSeat({ seatId:'kernel:nivo-backend:wf-stuck', role:'kernel', ledgerId:a.id, workflowId:'wf-stuck', state:'live', bootedAt:fixedNow - 3600000, lastSeenAt:fixedNow - 10000 });
  machine.seatTranscriptSnapshot({ seatId:'kernel:nivo-backend:wf-stuck', text:`Kernel considered retry ${secrets[0]}` });
  machine.upsertTerminal({ handle:'term-seed', role:'op', ledgerId:a.id, workflowId:'wf-stuck', jobId:'job-failed', attemptId:attempt.attempt_id, openedAt:fixedNow - 2900000, ownerRef:'seed' });
  machine.upsertTerminal({ handle:'term-missing', role:'op', ledgerId:a.id, workflowId:'wf-stuck', jobId:'job-missing-transcript', attemptId:missing.attempt_id, openedAt:fixedNow - 2400000, closedAt:fixedNow - 600000, ownerRef:'seed' });
  machine.setService({ name:'reconciler', kind:'host-app', state:'healthy' });
  machine.setThrottle({ mode:'heavy', effectiveCap:2, running:1, freeRamPct:11, reason:'seed pressure', writer:'seed' });
  machine.recordThrottleDecision({ ledgerId:a.id, workflowId:'wf-under-dispatched', reason:'RAM_THROTTLED', waitedMs:240000 });
  machine.setProviderHealth({ provider:'codex', status:'striking', strikes:2, reason:'seed backoff' });
  machine.setQuota({ provider:'codex', window:'5h', used:90, limitValue:100, resetAt:fixedNow + 3600000, source:'seed' });
  machine.setBudget({ scopeKey:'seed', limitValue:1000, window:'day' });
  machine.recordHostSample({ kind:'host', ramMb:4000, cpuPct:41, freeRamPct:11, freeRamMb:500, freeDiskGb:20 });
  const gc = machine.startGcRun({ trigger:'manual', startedAt:fixedNow - 30000 });
  machine.finishGcRun(gc, { freedBytes:0, counts:{terminals:0}, errors:[], finishedAt:fixedNow - 20000 });
  machine.recordMetrics({ kind:'progress', ledgerId:a.id, workflowId:'wf-stuck', data:{ratePerHour:0, queuedReady:1} });
  machine.recordMetrics({ kind:'progress', ledgerId:a.id, workflowId:'wf-under-dispatched', data:{running:1,queuedReady:1,ratePerHour:1,minRatePerHour:1} });
  for (const kind of ['rca','coverage','verify']) machine.recordMetrics({ kind, ledgerId:a.id, workflowId:'wf-stuck', data:{kind, status:'seed'} });
  machine.upsertLearning({ itemId:'lesson-check-red', kind:'lesson', title:'Run compile after edits', state:'kept', landedSha:fakeSha(10) });
  machine.upsertLearning({ itemId:'experiment-retry', kind:'experiment', parentId:'lesson-check-red', title:'Retry with changed scope', state:'reverted' });
  machine.upsertLane({ name:'seed-lane', worktreePath:path.join(root,'lane'), branch:'lane/seed', owner:'seed' });
  machine.recordLandRun({ lane:'seed-lane', spanId:span(11), commitSha:fakeSha(11), result:'failed', reason:'check failed', stdout:'seed stdout', stderr:'seed stderr', startedAt:fixedNow - 100000 });
  machine.recordLandRun({ lane:'seed-lane', spanId:span(12), commitSha:fakeSha(12), landedSha:fakeSha(13), result:'passed', stdout:'seed passed', stderr:'', startedAt:fixedNow - 90000 });
  machine.recordPush({ repoRoot:a.repoRoot, branch:'main', head:fakeSha(13), result:'pushed', stdout:'pushed' });
  machine.startProcessRun({ role:'engine', pid:12345, rev:'seed', startReason:'manual' });

  // Coverage is counted from persisted rows, rather than declared by the fixture code.
  const count = (handle, table, where = '') => Number(handle.prepare(`SELECT count(*) AS n FROM ${table} ${where}`).get().n);
  const rdb = a.ledger.db;
  const mdb = machine.db;
  const evidence = new Map([
    ['C1', count(rdb,'goals')], ['C2',count(rdb,'workflows')], ['C3',count(mdb,'seats')],
    ['C4',count(rdb,'work_units')], ['C5',count(rdb,'decisions')], ['C6',count(rdb,'op_attempts')],
    ['C7',count(rdb,'attempt_transcript_snapshots')], ['C8',count(rdb,'reports')], ['C9',count(rdb,'check_runs')],
    ['C10',count(rdb,'op_attempts',"WHERE verdict IS NOT NULL")], ['C11',count(mdb,'land_runs')],
    ['C12',count(rdb,'decision_items')], ['C13',count(mdb,'sla_episodes')], ['C14',count(mdb,'throttle_events')],
    ['C15',count(mdb,'terminals')], ['C16',count(mdb,'sup_learning')], ['C17',count(rdb,'logs')+count(mdb,'machine_logs')],
  ]);
  const states = mdb.prepare('SELECT ui FROM ui_states ORDER BY rank').all().map(row=>row.ui);
  console.log('Concept coverage:', [...evidence].map(([key,n])=>`${key}:${n}`).join(' '));
  console.log('UiState coverage:', states.join(' '));
  if ([...evidence.values()].some(n=>n===0) || states.length!==7) throw Error('Seed coverage incomplete');

  // Stable per-table content hashes allow reruns to be compared without checking binary SQLite layouts.
  for (const {ledger} of runtimes) ledger.close();
  machine.close();
  const generated = new Set(['event_id','digest','prev_digest']);
  const hashRows = (db, table) => {
    const rows = db.prepare(`SELECT * FROM "${table}"`).all().map(row => Object.fromEntries(Object.entries(row).filter(([key]) => !generated.has(key) && !key.endsWith('_at'))));
    rows.sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    return crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  };
  for (const [label,file,open] of [['machine',process.env.STARCI_TEST_MACHINE_FILE,openMachineReader],...runtimes.map(r=>[r.name,r.file,openLedgerReader])]) {
    const reader = label === 'machine' ? open({file}) : open(file);
    const source = label === 'machine' ? reader.db : reader;
    const tables = source.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%_fts%' ORDER BY name").all().map(r=>r.name);
    for (const table of tables) console.log(`${label}.${table} ${hashRows(source,table)}`);
    console.log(`${label}.user_version ${source.prepare('PRAGMA user_version').get().user_version}`);
    reader.close();
  }
} finally {
  for (const {ledger} of runtimes) try { ledger.close(); } catch {}
  try { machine.close(); } catch {}
}
