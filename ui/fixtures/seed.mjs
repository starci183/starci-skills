import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openMachine, openMachineObserver } from '../../engine/db/machine.mjs';
import { openLedger, openLedgerReader, ledgerIdForRepo, markBlobArchived } from '../../engine/db/ledger.mjs';
import { blobPath } from '../../engine/db/blob.mjs';
import { redactText } from '../../scripts/lib/redact.mjs';
import { readEnv } from '../../scripts/lib/env.mjs';
import { workflowView } from '../../scripts/kernel/progress-rca.mjs';
import { coverageOf, verifyProofs } from '../../scripts/kernel/proof-integrity.mjs';
import { runGit } from '../../scripts/api/git/lib.mjs';
import { add as gitAdd } from '../../scripts/api/git/add.mjs';
import { commit as gitCommit } from '../../scripts/api/git/commit.mjs';
import { revParse } from '../../scripts/api/git/rev-parse.mjs';
import { gitOutputOf, withoutGitLocalEnv } from '../../scripts/lib/git.mjs';
import { tempRoot } from '../../engine/temp-root.mjs';

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
const artifactRoot = safeGeneratedTarget(tempRoot(), 'ui-seed-artifacts');
fs.rmSync(artifactRoot, { recursive:true, force:true });
fs.mkdirSync(artifactRoot, { recursive:true });
const productsRoot = safeGeneratedTarget(tempRoot(), 'ui-seed-products');
fs.rmSync(productsRoot, { recursive:true, force:true });
fs.mkdirSync(productsRoot, { recursive:true });
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
const fakeSha = n => n.toString(16).padEnd(64, '0');
const trace = n => n.toString(16).padStart(32, '0');
const span = n => n.toString(16).padStart(16, '0');
const machine = openMachine({ file: readEnv('STARCI_TEST_MACHINE_FILE'), now });
const runtimes = [];
const previewChain = {
  status: 'ok',
  legs: ['scope.define', 'work.author', 'architecture.decide', 'backend.implement', 'interface.draw', 'code.refactor', 'interface.implement', 'integration.verify'].map((op, index) => ({ seq: index + 1, op })),
  edges: [
    ['scope.define', 'work.author'], ['work.author', 'architecture.decide'],
    ['architecture.decide', 'backend.implement'], ['architecture.decide', 'interface.draw'],
    ['backend.implement', 'code.refactor'], ['interface.draw', 'interface.implement'],
    ['code.refactor', 'integration.verify'], ['interface.implement', 'integration.verify'],
  ],
};

function makeRuntime(name, n) {
  const repoRoot = path.join(productsRoot, 'repositories', name);
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
  ledger.write.insertGoal({ workflowId: id, revision: 1, goalIdentity: `goal-${id}`, markdown: `Deliver ${title}`, goal: {title, ...(id === 'wf-stuck' ? { opChain: previewChain, derivedPlan: { legs: previewChain.legs, edges: previewChain.edges } } : {})}, approvedBy: 'owner', createdAt: fixedNow - 3600000 });
  if (phase !== 'queued') ledger.write.changeWorkflowPhase({ workflowId: id, to: 'running', by: 'kernel', reason: 'seed', at: fixedNow - 3500000 });
  if (phase !== 'queued' && phase !== 'running') ledger.write.changeWorkflowPhase({ workflowId: id, to: phase, by: 'owner', reason: 'seed', at: fixedNow - 100000 });
}

function productsRepository(repoRoot) {
  const repositories = safeGeneratedTarget(productsRoot, 'repositories');
  fs.mkdirSync(repositories, { recursive: true });
  const repo = safeGeneratedTarget(repositories, 'shop');
  if (canonical(repo) !== canonical(repoRoot) || !canonical(repo).startsWith(`${canonical(productsRoot)}/`)) throw Error('Products repository is outside the private Products fixture tree');
  fs.mkdirSync(repo, { recursive: true });
  if (fs.existsSync(path.join(repo, '.git'))) throw Error('Products fixture repository must be freshly generated');
  const hooks = safeGeneratedTarget(repo, '.fixture-hooks');
  fs.mkdirSync(hooks);
  const emptyConfig = safeGeneratedTarget(repo, '.fixture-gitconfig');
  fs.writeFileSync(emptyConfig, '');
  const identity = { name: 'StarCi UI fixture', email: 'ui-fixture@starci.local' };
  const options = at => ({ cwd: repo, timeout: 10000,
    config: { 'user.name': identity.name, 'user.email': identity.email, 'commit.gpgSign': 'false', 'core.autocrlf': 'false', 'core.hooksPath': hooks },
    env: { ...withoutGitLocalEnv(process.env), GIT_CONFIG_GLOBAL: emptyConfig, GIT_CONFIG_NOSYSTEM: '1',
      GIT_AUTHOR_NAME: identity.name, GIT_AUTHOR_EMAIL: identity.email, GIT_COMMITTER_NAME: identity.name, GIT_COMMITTER_EMAIL: identity.email,
      GIT_AUTHOR_DATE: new Date(at).toISOString(), GIT_COMMITTER_DATE: new Date(at).toISOString() } });
  gitOutputOf(runGit(['init', '--quiet', '--initial-branch=main', '--object-format=sha1'], options(fixedNow - 150000)), 'initialize private Products fixture repository');
  const initial = {
    'be/source/receipt.txt': 'Tested parent receipt: quantity=1.\n',
    'be/source/README.md': '# Products fixture\n\nParent version before checkpoint.\n',
    'be/source/removed.txt': 'Removed in the recorded checkpoint.\n',
  };
  const committed = {
    'be/source/receipt.txt': 'Recorded checkpoint receipt: quantity=2.\n',
    'be/source/README.md': '# Products fixture\n\nCommitted checkpoint renders Markdown.\n',
    'be/source/result.json': JSON.stringify({ source: 'recorded-checkpoint', quantity: 2, verified: true }, null, 2) + '\n',
    'be/source/removed.txt': null,
  };
  const write = (rel, content) => {
    const file = path.resolve(repo, rel);
    if (!canonical(file).startsWith(`${canonical(repo)}/`) || rel.split(/[\\/]+/).includes('.git')) throw Error('Products fixture path escapes its repository');
    if (content == null) { fs.rmSync(file); return; }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };
  for (const [rel, content] of Object.entries(initial)) write(rel, content);
  gitOutputOf(gitAdd(['-A', '--', 'be/source'], options(fixedNow - 150000)), 'stage Products tested parent');
  gitOutputOf(gitCommit(['--quiet', '-m', 'fixture: tested Products parent'], options(fixedNow - 150000)), 'commit Products tested parent');
  const testedHead = revParse(repo, 'HEAD');
  for (const [rel, content] of Object.entries(committed)) write(rel, content);
  gitOutputOf(gitAdd(['-A', '--', 'be/source'], options(fixedNow - 110000)), 'stage Products checkpoint');
  gitOutputOf(gitCommit(['--quiet', '-m', 'fixture: recorded Products checkpoint'], options(fixedNow - 110000)), 'commit Products checkpoint');
  const checkpointHead = revParse(repo, 'HEAD');
  if (!/^[a-f0-9]{40}$/.test(testedHead ?? '') || !/^[a-f0-9]{40}$/.test(checkpointHead ?? '') || testedHead === checkpointHead || revParse(repo, `${checkpointHead}^`) !== testedHead) throw Error('Products fixture requires two real parent/child commits');
  const workingCopy = 'WORKING COPY ONLY: quantity=999; must not appear in Products.\n';
  write('be/source/receipt.txt', workingCopy);
  return { repo, testedHead, checkpointHead, files: Object.keys(committed), committed, workingCopy };
}

try {
  const a = makeRuntime('shop', 1);
  const b = makeRuntime('ecommerce-app', 2);
  workflow(a, 'wf-stuck', 'Blocked delivery', 'running', 1);
  workflow(a, 'wf-under-dispatched', 'Ready work', 'running', 2);
  workflow(a, 'wf-paused', 'Paused delivery', 'paused', 3);
  workflow(a, 'wf-stopped', 'Stopped delivery', 'stopped', 4);
  workflow(a, 'wf-done', 'Finished delivery', 'finished', 5);
  workflow(b, 'wf-secondary', 'Second project', 'running', 6);

  const db = a.ledger;
  db.write.createUnit({ workflowId: 'wf-stuck', unitId: 'unit-failed', opId: 'code.refactor', subjectKey: 'source-a', goalRevision: 1, title: 'Compile source', createdAt: fixedNow - 3400000 });
  db.write.createUnit({ workflowId: 'wf-stuck', unitId: 'unit-blocked', opId: 'interface.implement', subjectKey: 'screen-b', goalRevision: 1, title: 'Blocked screen', createdAt: fixedNow - 3400000 });
  if (!db.write.addUnitEdge({ workflowId: 'wf-stuck', fromUnit: 'unit-failed', toUnit: 'unit-blocked', kind: 'after', source: 'plan', createdAt: fixedNow - 3300000 })) {
    throw Error('Seed dependency edge was not written');
  }
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
  db.write.declareResource({ resourceKey: 'repo:seed-expired', capacity: 1, declaredBy: 'seed', at: fixedNow - 3100000 });
  db.write.acquireLease({ resourceKey: 'repo:seed-expired', jobId: 'job-active', units: 1,
    holder: 'seed-active-op', expiresAt: fixedNow - 20000, at: fixedNow - 3000000 });
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
  // An unmarked text blob exercises the server's defensive stream redaction.
  const unmarked = db.write.storeBlob({ content: Buffer.from(outputText), mediaType: 'text/plain', createdAt: fixedNow });
  const stderr = db.write.storeBlob({ content: Buffer.from(redactText(`compile error ${secrets[1]}`)), mediaType: 'text/plain', redaction: 'v1', createdAt: fixedNow });
  for (const [name, present] of [['archived-readable.log', true], ['archived-unavailable.log', false]]) {
    const archived = db.write.storeBlob({ content: Buffer.from(`Fixture archive evidence: ${name}\n`), mediaType: 'text/plain', redaction: 'v1', createdAt: fixedNow });
    db.write.recordArtifact({ attemptId: attempt.attempt_id, name, sha256: archived.sha256, role: 'log', kind: 'log', createdAt: fixedNow });
    markBlobArchived(db, { sha256: archived.sha256, archivedAt: fixedNow, archiveRef: `fixture.zip!${name}` });
    if (!present) {
      const bytes = blobPath(archived.sha256);
      const resolved = bytes && fs.realpathSync.native(bytes);
      if (!resolved || !canonical(resolved).startsWith(`${canonical(artifactRoot)}/`)) throw Error('Archive bytes are outside the private fixture artifact root');
      fs.rmSync(resolved);
    }
  }
  const transcript = db.write.storeBlob({ content: Buffer.from(redactText(`Agent began work\n${secrets[2]}\nCompile failed`)), mediaType: 'text/plain', redaction: 'v1', createdAt: fixedNow });
  for (let i = 0; i < 3; i++) db.write.recordTranscriptSnapshot({ attemptId: attempt.attempt_id, sha256: db.write.storeBlob({content: Buffer.from(redactText(`Snapshot ${i}\n${secrets[0]}`)), mediaType:'text/plain', redaction:'v1', createdAt:fixedNow + i }).sha256, lines: 2, bytes: 24, at: fixedNow - 2400000 + i * 60000 });
  db.write.setAttemptTranscript({ attemptId: attempt.attempt_id, transcriptSha: transcript.sha256, at: fixedNow - 100000 });
  db.write.fileReport({ attemptId: attempt.attempt_id, outcome: 'done', report: {summary: `Claimed done ${secrets[3]}`}, createdAt: fixedNow - 200000 });
  db.write.recordCheckRun({ attemptId: attempt.attempt_id, name: 'tsc-app', phase: 'after', runner: 'settler', spanId:span(4), status: 'fail', exitCode: 2, stdoutSha: output.sha256, stderrSha: stderr.sha256, startedAt: fixedNow - 180000, finishedAt: fixedNow - 179000, createdAt: fixedNow - 180000 });
  db.write.recordCheckRun({ attemptId: attempt.attempt_id, name: 'lint', phase: 'after', runner: 'settler', spanId:span(5), status: 'fail', exitCode: 1, stdoutSha: output.sha256, stderrSha: stderr.sha256, startedAt: fixedNow - 178000, finishedAt: fixedNow - 177000, createdAt: fixedNow - 178000 });
  db.write.updateAttempt({ attemptId: attempt.attempt_id, verdict: 'fail', settledBy: 'settler', failureClass: 'check-red', endState: 'settled', settledAt: fixedNow - 170000, terminalClosedAt: fixedNow - 160000, at: fixedNow - 170000 });
  db.write.appendEvent({ eventId:'event-failed-preserved', workflowId:'wf-stuck', entityType:'job', entityId:'job-failed', attemptId:attempt.attempt_id,
    kind:'workflow-op-preserved', payload:{sha:fakeSha(22), branch:'preserved/wf-stuck/code.refactor'}, createdAt:fixedNow - 171000 });
  db.write.recordArtifact({ attemptId: attempt.attempt_id, name: 'compile-output.txt', sha256: output.sha256, role: 'check-output', kind: 'log', createdAt: fixedNow - 180000 });
  // Exercise both text hunks and archived image-side resolution in the read-only diff UI.
  const image = db.write.storeBlob({ content: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lHEAAAAASUVORK5CYII=', 'base64'), mediaType: 'image/png', redaction: 'v1', createdAt: fixedNow });
  const patch = db.write.storeBlob({ content: Buffer.from(JSON.stringify({
    schema: 'starci/patch-json@1', base: fakeSha(20), head: fakeSha(21), landed: null, unlanded: true,
    commits: [{ sha: fakeSha(21), subject: 'seed: show failed compile evidence' }],
    totals: { files: 2, added: 1, removed: 1 }, truncated: false, omittedFiles: 0,
    files: [
      { path: 'src/table.tsx', oldPath: null, status: 'M', added: 1, removed: 1, language: 'tsx', binary: false, image: false, touches: 1, truncated: false,
        hunks: [{ header: '@@ -1 +1 @@', oldStart: 1, newStart: 1, lines: [{ t: '-', o: 1, n: null, s: 'export const size = 1;' }, { t: '+', o: null, n: 1, s: 'export const size = 2;' }] }] },
      { path: 'evidence/table.png', oldPath: null, status: 'M', added: 0, removed: 0, language: 'image', binary: true, image: true, touches: 1, truncated: false, hunks: [],
        before: { blob: image.sha256, asset: 'before.png' }, after: { blob: image.sha256, asset: 'after.png' } },
    ],
  })), mediaType: 'application/json', redaction: 'v1', createdAt: fixedNow });
  db.write.recordArtifact({ attemptId: attempt.attempt_id, name: 'patch.json', sha256: patch.sha256, role: 'diff', kind: 'diff', subkind: 'patch-json', createdAt: fixedNow - 180000 });
  db.write.recordArtifact({ attemptId: attempt.attempt_id, name: 'patch.assets/before.png', sha256: image.sha256, role: 'diff', kind: 'image', createdAt: fixedNow - 180000 });
  db.write.recordArtifact({ attemptId: attempt.attempt_id, name: 'patch.assets/after.png', sha256: image.sha256, role: 'diff', kind: 'image', createdAt: fixedNow - 180000 });
  const video = db.write.storeBlob({ content: fs.readFileSync(path.join(here, 'media', 'sample-1s.mp4')), mediaType: 'video/mp4', redaction: 'v1', createdAt: fixedNow });
  db.write.recordArtifact({ attemptId: attempt.attempt_id, name: 'sample-1s.mp4', sha256: video.sha256, role: 'video', kind: 'video', createdAt: fixedNow - 180000 });
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
  machine.upsertSeat({ seatId:'kernel:shop:wf-stuck', role:'kernel', ledgerId:a.id, workflowId:'wf-stuck', state:'live', bootedAt:fixedNow - 3600000, lastSeenAt:fixedNow - 10000 });
  machine.seatTranscriptSnapshot({ seatId:'kernel:shop:wf-stuck', text:`Kernel considered retry ${secrets[0]}` });
  db.write.updateAttempt({ attemptId:attempt.attempt_id, terminalHandle:'term-seed', at:fixedNow - 2900000 });
  db.write.updateAttempt({ attemptId:missing.attempt_id, terminalHandle:'term-missing', at:fixedNow - 2400000 });
  machine.upsertTerminal({ handle:'term-shell-seed', title:'Terminal 3', role:'shell', openedAt:fixedNow - 2900000 });
  machine.setService({ name:'reconciler', kind:'host-app', state:'healthy' });
  machine.setThrottle({ mode:'heavy', effectiveCap:2, running:1, freeRamPct:11, reason:'seed pressure', writer:'seed' });
  machine.recordThrottleDecision({ ledgerId:a.id, workflowId:'wf-under-dispatched', reason:'RAM_THROTTLED', waitedMs:240000 });
  machine.setProviderHealth({ provider:'codex', status:'striking', strikes:2, reason:'seed backoff' });
  machine.setQuota({ provider:'codex', window:'5h', used:90, limitValue:100, resetAt:fixedNow + 3600000, source:'seed' });
  machine.setBudget({ scopeKey:'seed', limitValue:1000, window:'day' });
  machine.recordHostSample({ kind:'host', ramMb:4000, cpuPct:41, freeRamPct:11, freeRamMb:500, freeDiskGb:20 });
  const gc = machine.startGcRun({ trigger:'manual', startedAt:fixedNow - 30000 });
  machine.finishGcRun(gc, { freedBytes:0, counts:{terminals:0}, errors:[], finishedAt:fixedNow - 20000 });
  machine.upsertLearning({ itemId:'lesson-check-red', kind:'lesson', title:'Run compile after edits', state:'kept', landedSha:fakeSha(10) });
  machine.upsertLearning({ itemId:'experiment-retry', kind:'experiment', parentId:'lesson-check-red', title:'Retry with changed scope', state:'reverted' });
  machine.upsertLane({ name:'seed-lane', worktreePath:path.join(root,'lane'), branch:'lane/seed', owner:'seed' });
  machine.recordLandRun({ lane:'seed-lane', spanId:span(11), commitSha:fakeSha(11), result:'failed', reason:'check failed', stdout:'seed stdout', stderr:'seed stderr', startedAt:fixedNow - 100000 });
  machine.recordLandRun({ lane:'seed-lane', spanId:span(12), commitSha:fakeSha(12), landedSha:fakeSha(13), result:'passed', stdout:'seed passed', stderr:'', startedAt:fixedNow - 90000 });
  machine.recordPush({ repoRoot:a.repoRoot, branch:'main', head:fakeSha(13), result:'pushed', stdout:'pushed' });
  machine.startProcessRun({ role:'engine', pid:12345, rev:'seed', startReason:'manual' });

  // Recorded fixture receipts exercise commit actions separately from verdict and workflow integration.
  for (const [suffix, op, outcome, verdict, commitAction] of [
    ['passed', 'backend.implement', 'done', 'pass', 'new'],
    ['owner', 'integration.verify', 'ask', 'blocked', null],
    ['unchanged', 'code.refactor', 'done', 'pass', 'unchanged'],
    ['unbound', 'code.refactor', 'done', 'pass', 'unbound'],
    ['missing-checkpoint', 'code.refactor', 'done', 'pass', null],
    ['checkpoint-unsettled', 'code.refactor', 'done', null, 'new'],
  ]) {
    const unitId = `unit-${suffix}`;
    const jobId = `job-${suffix}`;
    db.write.createUnit({ workflowId:'wf-stuck', unitId, opId:op, subjectKey:suffix, goalRevision:1, title:`Preview ${suffix}`, createdAt:fixedNow - 300000 });
    db.write.enqueueJob({ jobId, workflowId:'wf-stuck', unitId, opId:op, createdAt:fixedNow - 290000 });
    db.write.setJobStatus({ jobId, to:'ready', at:fixedNow - 280000 });
    db.write.setJobStatus({ jobId, to:'leased', leaseToken:`seed-${suffix}`, at:fixedNow - 270000 });
    const testedHead = fakeSha(30);
    const record = db.write.startAttempt({ workflowId:'wf-stuck', jobId, dispatchId:`dispatch-${suffix}`, agent:'codex', provider:'openai', model:'seed-model',
      repoRoot:a.repoRoot, headSha:testedHead, dispatchedAt:fixedNow - 260000, at:fixedNow - 260000 });
    db.write.setJobStatus({ jobId, to:'running', at:fixedNow - 250000 });
    db.write.fileReport({ attemptId:record.attempt_id, outcome, report:{summary:suffix === 'owner' ? 'Owner input is required before continuing.' : 'Preview source check completed.', head:testedHead}, createdAt:fixedNow - 230000 });
    db.write.setJobStatus({ jobId, to:'reported', at:fixedNow - 230000 });
    if (verdict === 'pass') db.write.recordCheckRun({ attemptId:record.attempt_id, name:'preview-check', phase:'after', runner:'settler', status:'pass', exitCode:0, startedAt:fixedNow - 220000, finishedAt:fixedNow - 210000, createdAt:fixedNow - 220000 });
    if (commitAction) {
      const payload = commitAction === 'unbound' ? {sha:fakeSha(32)} : {sha:commitAction === 'new' ? fakeSha(31) : testedHead,
        committed:commitAction === 'new', scope:['be/source'], files:commitAction === 'new' ? ['be/source/table.ts'] : []};
      db.write.appendEvent({ eventId:`event-checkpoint-${suffix}`, workflowId:'wf-stuck', entityType:'job', entityId:jobId,
        attemptId:record.attempt_id, kind:'workflow-checkpoint', payload, createdAt:fixedNow - 201000 });
    }
    if (verdict != null) {
      db.write.updateAttempt({ attemptId:record.attempt_id, verdict, settledBy:'settler', endState:'settled', settledAt:fixedNow - 200000, terminalClosedAt:fixedNow - 190000, at:fixedNow - 200000 });
      db.write.setJobStatus({ jobId, to:suffix === 'owner' ? 'awaiting_owner' : 'succeeded', at:fixedNow - 190000 });
    }
    db.write.setUnitState({ workflowId:'wf-stuck', unitId, to:verdict == null ? 'running' : verdict === 'pass' ? 'done' : 'failed', at:fixedNow - 190000 });
    if (suffix === 'owner') db.write.openDecisionItem({ diId:'di-attempt-owner', idempotencyKey:'preview:owner:attempt', keyParts:{kind:'preview',entity:unitId,signature:'owner',head:'one'}, workflowId:'wf-stuck', kind:'owner-input', decider:'owner', summary:'Preview requires owner input', openedBy:'kernel', at:fixedNow - 190000 });
  }

  const products = productsRepository(a.repoRoot);
  const productsJob = 'job-products-positive';
  const productsUnit = 'unit-products-positive';
  db.write.createUnit({ workflowId:'wf-stuck', unitId:productsUnit, opId:'code.refactor', subjectKey:'products-positive', goalRevision:1,
    title:'Committed Products preview', createdAt:fixedNow - 160000 });
  db.write.enqueueJob({ jobId:productsJob, workflowId:'wf-stuck', unitId:productsUnit, opId:'code.refactor',
    payload:{ owned_paths:['be/source'] }, createdAt:fixedNow - 155000 });
  db.write.setJobStatus({ jobId:productsJob, to:'ready', at:fixedNow - 150000 });
  db.write.setJobStatus({ jobId:productsJob, to:'leased', leaseToken:'seed-products-positive', at:fixedNow - 145000 });
  const productsAttempt = db.write.startAttempt({ workflowId:'wf-stuck', jobId:productsJob, dispatchId:'dispatch-products-positive', spanId:span(9),
    agent:'codex', provider:'openai', model:'seed-model', routedBy:'route', repoRoot:products.repo,
    baseSha:products.testedHead, headSha:products.testedHead, dispatchedAt:fixedNow - 140000, at:fixedNow - 140000 });
  if (productsAttempt.attempt_id !== 9) throw Error('Products positive fixture must retain Attempt ID 9');
  db.write.setJobStatus({ jobId:productsJob, to:'running', at:fixedNow - 139000 });
  db.write.setUnitState({ workflowId:'wf-stuck', unitId:productsUnit, to:'running', at:fixedNow - 139000 });
  db.write.fileReport({ attemptId:productsAttempt.attempt_id, outcome:'done', report:{ summary:'Fixture text, Markdown and JSON are recorded in the runtime checkpoint; the obsolete fixture file is deleted.',
    head:products.testedHead, files:products.files, claims:[{ paths:products.files, summary:'Recorded Products fixture output' }] }, createdAt:fixedNow - 120000 });
  db.write.setJobStatus({ jobId:productsJob, to:'reported', at:fixedNow - 120000 });
  const productsCheck = db.write.storeBlob({ content:Buffer.from('Illustrative fixture receipt: independent runtime Products preview check passed.\n'),
    mediaType:'text/plain', redaction:'v1', createdAt:fixedNow - 117000 });
  db.write.recordCheckRun({ attemptId:productsAttempt.attempt_id, name:'products-preview-check', phase:'after', runner:'settler', authority:'runtime',
    status:'pass', exitCode:0, stdoutSha:productsCheck.sha256, startedAt:fixedNow - 118000, finishedAt:fixedNow - 117000, createdAt:fixedNow - 118000 });
  db.write.appendEvent({ eventId:'event-checkpoint-products-positive', workflowId:'wf-stuck', entityType:'job', entityId:productsJob, attemptId:productsAttempt.attempt_id,
    kind:'workflow-checkpoint', payload:{ sha:products.checkpointHead, committed:true, scope:['be/source'], files:products.files,
      attemptId:productsAttempt.attempt_id, dispatchId:'dispatch-products-positive', workflowId:'wf-stuck', jobId:productsJob }, createdAt:fixedNow - 110000 });
  db.write.updateAttempt({ attemptId:productsAttempt.attempt_id, verdict:'pass', settledBy:'settler', endState:'settled',
    settledAt:fixedNow - 100000, terminalClosedAt:fixedNow - 99000, at:fixedNow - 100000 });
  db.write.setJobStatus({ jobId:productsJob, to:'succeeded', at:fixedNow - 99000 });
  db.write.setUnitState({ workflowId:'wf-stuck', unitId:productsUnit, to:'done', at:fixedNow - 99000 });
  const productsManifest = { attemptId:productsAttempt.attempt_id, workflowId:'wf-stuck', jobId:productsJob, unitId:productsUnit, op:'code.refactor', repoRoot:products.repo,
    reportHead:products.testedHead, checkpointHead:products.checkpointHead, committed:products.committed,
    workingCopy:{ path:'be/source/receipt.txt', content:products.workingCopy }, files:products.files };
  fs.writeFileSync(safeGeneratedTarget(productsRoot, 'products-positive.json'), JSON.stringify(productsManifest, null, 2) + '\n');
  console.log('Products positive fixture:', JSON.stringify({ attemptId:productsAttempt.attempt_id, reportHead:products.testedHead, checkpointHead:products.checkpointHead,
    manifest:path.join(productsRoot, 'products-positive.json') }));

  // Coverage is counted from persisted rows, rather than declared by the fixture code.
  const count = (handle, table, where = '') => Number(handle.prepare(`SELECT count(*) AS n FROM ${table} ${where}`).get().n);
  const rdb = a.ledger.db;
  const mdb = machine.db;
  for (const workflowId of ['wf-stuck', 'wf-under-dispatched']) {
    const view = workflowView({ db:rdb, workflowId, repo:a.repoRoot, now:fixedNow });
    machine.recordMetrics({ kind:'progress', ledgerId:a.id, workflowId, data:view.progress });
    if (workflowId === 'wf-stuck') {
      machine.recordMetrics({ kind:'rca', ledgerId:a.id, workflowId, data:view.rca });
      machine.recordMetrics({ kind:'coverage', ledgerId:a.id, workflowId, data:coverageOf(rdb, workflowId, {repo:a.repoRoot}) });
      machine.recordMetrics({ kind:'verify', ledgerId:a.id, workflowId, data:verifyProofs(rdb, workflowId) });
    }
  }
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
  for (const [label,file,open] of [['machine',readEnv('STARCI_TEST_MACHINE_FILE'),openMachineObserver],...runtimes.map(r=>[r.name,r.file,openLedgerReader])]) {
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
