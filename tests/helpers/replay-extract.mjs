// replay-extract.mjs - reduces a read-only copy of a real ledger to the minimal fixture that reproduces one case, every free-text and path field replaced by a neutral
// placeholder (replay-neutral.mjs), and refuses to write a fixture the hygiene scan (replay-hygiene.mjs) finds anything in.
//
//   node tests/helpers/replay-extract.mjs <case> <ledger-copy-dir> [--out <dir>]      (default out: tests/fixtures/replay)
//
// The copy directory holds `<ledger>/runtime.sqlite` per product ledger (and, for the read-plan case, the manifest the Kernel was asked to attest). Nothing is
// read from the live host; the copy is opened read-only. The extractor is deterministic: the same copy gives the same bytes.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { FIXTURES } from './replay-world.mjs';
import { Pseudonyms, wordOr, wordsOf } from './replay-neutral.mjs';
import { scanFixture } from './replay-hygiene.mjs';

const WORKFLOW = 'wf-1';
const parse = (text) => { try { return JSON.parse(text); } catch { return null; } };
// Every handle a recipe opens is closed when its extraction ends (a leaked handle holds the copy open on Windows).
const opened = [];
/** The ledger file of `name` in a copy: `<name>/runtime.sqlite`, else the newest `<name>-monorepo-*.sqlite` beside it (a later copy of the same ledger), else `<name>.sqlite`. */
function ledgerFileOf(copy, name) {
  const nested = path.join(copy, name, 'runtime.sqlite');
  const flat = fs.readdirSync(copy).filter((entry) => entry.startsWith(`${name}-monorepo-`) && entry.endsWith('.sqlite')).sort().at(-1);
  const plain = path.join(copy, `${name}.sqlite`);
  return flat ? path.join(copy, flat) : (fs.existsSync(nested) ? nested : plain);
}
const openLedger = (copy, name) => { const db = new DatabaseSync(ledgerFileOf(copy, name), { readOnly: true }); opened.push(db); return db; };
const rows = (db, sql, ...args) => db.prepare(sql).all(...args);
const first = (db, sql, ...args) => db.prepare(sql).get(...args) ?? null;
const countOf = (db, sql, ...args) => Number(first(db, sql, ...args).n);

/** Every event of `kind` as {seq, at, entity, p} with its payload parsed. */
const eventsOf = (db, kind) => rows(db, 'SELECT seq, created_at, entity_id, payload_json FROM events WHERE kind=? ORDER BY seq', kind)
  .map((row) => ({ seq: Number(row.seq), at: Number(row.created_at), entity: row.entity_id, p: parse(row.payload_json) ?? {} }));

/** A fixture job from a real job row: neutral id, runtime-vocabulary op, the status; `extra` carries the case's own fields. */
const jobOf = (ids, row, extra = {}) => ({ id: ids.id('job', row.job_id), op: wordOr(row.op_id), status: row.status, ...extra });

/** The plan legs and edges of the goal restricted to `ops`. */
function planOf(db, ops) {
  const goal = parse(first(db, 'SELECT json FROM goals ORDER BY revision DESC LIMIT 1')?.json) ?? {};
  const plan = goal.derivedPlan ?? { legs: [], edges: [] };
  const known = new Set((plan.legs ?? []).map((leg) => leg.op));
  const kept = ops.filter((op) => known.has(op));
  return { legs: kept.map((op) => ({ op })), edges: (plan.edges ?? []).filter(([from, to]) => kept.includes(from) && kept.includes(to)) };
}

/** Case c and f: a Kernel answers none-fits to a leg-ready item whose node name the redaction filter rewrites. */
function legReady(copy) {
  const db = openLedger(copy, 'starci');
  const answers = eventsOf(db, 'kernel-decision').filter((e) => String(e.p.menu?.item).startsWith('leg-ready:') && e.p.menu?.choice === 'none-fits');
  const [, op, ...rest] = String(answers[0].p.menu.item).split(':');
  const ids = new Pseudonyms();
  const node = ids.node(rest.slice(0, -1).join(':'));
  const succeeded = rows(db, "SELECT DISTINCT op_id FROM jobs WHERE status='succeeded'").map((r) => r.op_id);
  const plan = planOf(db, [...succeeded, op]);
  const before = plan.legs.map((leg) => leg.op).filter((leg) => leg !== op).at(-1);
  const done = first(db, "SELECT * FROM jobs WHERE op_id=? AND status='succeeded' ORDER BY created_at DESC", before);
  return {
    workflow: { id: WORKFLOW, phase: first(db, 'SELECT phase FROM workflows').phase, goalRevision: 0 },
    plan: { legs: [{ op: before }, { op }], edges: [[before, op]] },
    workGraph: { nodes: [{ id: node, domain: node.split('.')[0], owned: ['own-1'] }] },
    jobs: [jobOf(ids, done, { owned: ['own-9'] })],
    live: { noneFitsAnswers: answers.length, menuEscapes: countOf(db, "SELECT count(*) n FROM decision_items WHERE kind='menu-escape'"), op },
  };
}

/** Case d: the size of the Kernel's read plan before and after the revision that outgrew the inline event bound. */
function readPlan(copy) {
  const db = openLedger(copy, 'starci');
  const ack = eventsOf(db, 'runtime-rev-acked').filter((e) => e.p.readManifest).at(-1);
  const grown = parse(fs.readFileSync(path.join(copy, 'manifest.json'), 'utf8'));
  const files = ack.p.readManifest.files;
  const inline = first(db, "SELECT length(payload_json) n FROM events WHERE kind='runtime-rev-acked' AND payload_json IS NOT NULL ORDER BY seq DESC LIMIT 1");
  return {
    workflow: { id: WORKFLOW, phase: 'running', goalRevision: 0 },
    runtime: { readPlan: { total: files.length, pathBytes: Math.round(files.reduce((sum, f) => sum + f.path.length, 0) / files.length), grownTotal: grown.files.length } },
    ops: ['review.verify'],
    live: { inlineAckBytes: Number(inline.n), limitBytes: 16384, grownManifestBytes: JSON.stringify(grown).length },
  };
}

/** Case e: a failed job, the retry the failure route queued behind its curing leg, and the leg that cured it. */
function shapeGuard(copy) {
  const db = openLedger(copy, 'starci');
  const routed = eventsOf(db, 'failure-routed').find((e) => e.p.route === 'upstream-lands-first');
  const failed = first(db, 'SELECT * FROM jobs WHERE job_id=?', routed.entity);
  const retry = first(db, 'SELECT * FROM jobs WHERE job_id=?', routed.p.jobs[0]);
  const cure = first(db, "SELECT * FROM jobs WHERE op_id=? AND status='succeeded' ORDER BY created_at DESC", routed.p.upstream);
  const report = parse(first(db, 'SELECT report_json r FROM reports WHERE job_id=?', failed.job_id).r);
  const params = Object.fromEntries(Object.entries(parse(failed.payload_json).params ?? {}).filter(([, value]) => typeof value === 'number'));
  const ids = new Pseudonyms();
  for (const row of [cure, failed, retry]) ids.id('job', row.job_id);
  const cureJob = jobOf(ids, cure, { owned: ['own-9'] });
  const failedJob = jobOf(ids, failed, { owned: ['own-1'], params, report: { outcome: report.outcome, blocker: { kind: wordOr(report.blocker?.kind) }, cause: 'grant-too-narrow' },
    result: { verdict: 'blocked', nextStep: { kind: 'retry', route: wordOr(routed.p.route), counted: routed.p.counted === true, upstream: wordOr(routed.p.upstream), mode: wordOr(routed.p.mode), jobs: [ids.id('job', retry.job_id)] } } });
  const retryJob = jobOf(ids, retry, { owned: ['own-1'], params, unit: failedJob.id, tryNo: retry.try_no, retryOf: failedJob.id, after: [cureJob.id],
    routed: { route: wordOr(routed.p.route), from: failedJob.id, firing: 1, limit: 1 } });
  return { workflow: { id: WORKFLOW, phase: 'running', goalRevision: 0 }, jobs: [cureJob, failedJob, retryJob],
    live: { skippedPushes: countOf(db, "SELECT count(*) n FROM events WHERE kind='kernel-dispatch-push' AND payload_json LIKE '%same-failing-shape%'") } };
}

/** The handover event of a reported job, reduced to vocabulary words. */
const handoverEvent = (id, handover) => ({ kind: 'job-settle-needs-kernel', entity: id, at: -60_000,
  payload: { reason: wordOr(handover.p.reason), code: wordOr(handover.p.code), detail: wordsOf(handover.p.detail).length ? wordsOf(handover.p.detail) : [wordOr(handover.p.code)], outcome: wordOr(handover.p.outcome), op: wordOr(handover.p.op), attempt: Number(handover.p.attempt), runtimeRev: '$rev:1' } });

/** The reported decision job of the Nivo-shaped copy that a handover event with `code` names. */
function reportedWith(copy, code) {
  const db = openLedger(copy, 'nivo');
  const handover = eventsOf(db, 'job-settle-needs-kernel').find((e) => e.p.code === code);
  const job = first(db, 'SELECT * FROM jobs WHERE job_id=?', handover.entity);
  const ids = new Pseudonyms();
  const attempt = first(db, 'SELECT provider, agent FROM op_attempts WHERE job_id=? ORDER BY attempt_id DESC LIMIT 1', job.job_id);
  const fixtureJob = jobOf(ids, job, { admitted: true, provider: wordOr(attempt.provider ?? attempt.agent), owned: ['d1.sds'], report: { outcome: 'done', checks: [{ name: 'check-1' }] },
    at: { created: -7_200_000, updated: -3_600_000 } });
  return { db, handover, fixtureJob,
    base: { workflow: { id: WORKFLOW, phase: 'running', goalRevision: 0 }, jobs: [fixtureJob], tree: { records: ['d1.sds.rec-1'] },
      decisions: [{ kind: 'settle-nongreen', entity: { type: 'job', id: fixtureJob.id } }], events: [handoverEvent(fixtureJob.id, handover)] } };
}

/** Case a: a done decision report the settler handed to the Kernel for a missing Critic verdict. */
function handedOver(copy) {
  const { handover, base } = reportedWith(copy, 'op-critic-verdict-missing');
  return { ...base, live: { handoverAgeMs: Number(handover.p.ageMs) } };
}

/** Case b: the same report after a Kernel's settle-fail whose branch rewind failed and left a prepared decision. */
function preparedFail(copy) {
  const { db, base } = reportedWith(copy, 'workflow-checkpoint-recovery-conflict');
  const checkpoints = countOf(db, "SELECT count(*) n FROM events WHERE kind='workflow-checkpoint'");
  const failedRewinds = eventsOf(db, 'kernel-decision-result').filter((e) => String(e.p.observed).includes('workflow-reset-failed')).length;
  return { ...base, tree: { records: ['d1.sds.rec-1'], checkpoints, preserved: 1, prepared: { resetTo: 'baseline', verdict: 'fail', halfApplied: true } },
    live: { failedRewinds, checkpointsBehind: checkpoints } };
}

/** Case g: a ready retry whose worker-start the host refused consumer_fenced three times, which excluded every pool. */
function fencedRetry(copy) {
  const db = openLedger(copy, 'nivo');
  const fences = rows(db, "SELECT entity_id FROM events WHERE kind='dispatch-rejected' AND payload_json LIKE '%consumer_fenced%' ORDER BY seq");
  const retry = first(db, 'SELECT * FROM jobs WHERE job_id=?', fences[0].entity_id);
  const failed = first(db, 'SELECT * FROM jobs WHERE job_id=?', retry.retry_of);
  const ids = new Pseudonyms();
  for (const row of [failed, retry]) ids.id('job', row.job_id);
  const failedJob = jobOf(ids, failed, { owned: ['own-1'], provider: 'claude', result: { verdict: 'fail' } });
  // The live job stood ready after its first refused launches; the replay starts at the queued job and lets the runtime refuse it.
  const retryJob = jobOf(ids, retry, { status: 'queued', owned: ['own-1'], unit: failedJob.id, tryNo: retry.try_no, retryOf: failedJob.id });
  return { workflow: { id: WORKFLOW, phase: 'running', goalRevision: 0 }, jobs: [failedJob, retryJob], live: { fencedRefusals: fences.length, retryStatus: retry.status } };
}

/** Case h: a ready interface op refused grammar-context-missing while the brand record sat in the workflow tree. */
function grammarInTree(copy) {
  const db = openLedger(copy, 'starci');
  const refused = eventsOf(db, 'kernel-dispatch-push').find((e) => e.p.results?.some((r) => String(r.error).startsWith('grammar-context-missing')));
  const job = first(db, 'SELECT * FROM jobs WHERE job_id=?', refused.p.results[0].jobId);
  const brand = first(db, "SELECT * FROM jobs WHERE op_id='brand.decide' AND status='succeeded' ORDER BY created_at DESC");
  const ids = new Pseudonyms();
  const brandJob = jobOf(ids, brand, { owned: ['own-9'] });
  const drawJob = jobOf(ids, job, { owned: ['own-1'], params: Object.fromEntries(Object.entries(parse(job.payload_json).params ?? {}).filter(([, value]) => typeof value === 'number')) });
  return { workflow: { id: WORKFLOW, phase: 'running', goalRevision: 0 }, jobs: [brandJob, drawJob], tree: { brand: true }, live: { refusedPushes: eventsOf(db, 'kernel-dispatch-push').filter((e) => e.p.results?.some((r) => String(r.error).startsWith('grammar-context-missing'))).length, drawStatus: job.status } };
}

/** Case i: an interface.draw dispatched on a host with no render tool resolvable from its tree; it spent 7.4M tokens, reported blocked environment and a supervisor-gate held it. */
function drawRenderTool(copy) {
  const db = openLedger(copy, 'starci');
  const routed = eventsOf(db, 'failure-routed').filter((e) => e.p.shape?.blocker === 'environment' && e.p.opId === 'interface.draw').at(-1);
  const job = first(db, 'SELECT * FROM jobs WHERE job_id=?', routed.entity);
  const brand = first(db, "SELECT * FROM jobs WHERE op_id='brand.decide' AND status='succeeded' ORDER BY created_at DESC");
  const attempt = first(db, 'SELECT tokens_in, tokens_out FROM op_attempts WHERE job_id=? ORDER BY attempt_id DESC LIMIT 1', job.job_id);
  const ids = new Pseudonyms();
  const brandJob = jobOf(ids, brand, { owned: ['own-9'] });
  const drawJob = jobOf(ids, job, { owned: ['own-1'], params: Object.fromEntries(Object.entries(parse(job.payload_json).params ?? {}).filter(([, value]) => typeof value === 'number')),
    report: { outcome: 'blocked', blocker: { kind: 'environment' } } });
  return { workflow: { id: WORKFLOW, phase: 'running', goalRevision: 0 }, jobs: [brandJob, drawJob], tree: { brand: true },
    live: { drawStatus: job.status, tryNo: Number(job.try_no), attemptTokens: Number(attempt.tokens_in) + Number(attempt.tokens_out), route: wordOr(routed.p.route), routeLimit: Number(routed.p.limit), routeFiring: Number(routed.p.firing),
      gate: wordOr(routed.p.kind), gateIncidents: countOf(db, "SELECT count(*) n FROM incidents WHERE status='open' AND last_progress LIKE '[supervisor-gate]%'") } };
}

/**
 * Case j: every launch of a codex worker through worker-start ended outcome_unknown / turn_start_unobserved (Codex 0.160 folded the 16.8 KB Task spec into a pasted-content
 * chip and the Enter did not submit it); the Nivo Kernel stood unstarted. The ledger gives the facts of the failed Kernel launches; the world needs an op to launch, so the jobs
 * are the neutral ready interface op behind a finished brand leg.
 */
function codexTurnStart(copy) {
  const db = openLedger(copy, 'nivo');
  const failed = eventsOf(db, 'kernel-start-failed');
  const codex = failed.filter((e) => e.p.agent === 'codex' || e.p.admission?.decision?.selected?.agent === 'codex');
  const ids = new Pseudonyms();
  const brandJob = { id: ids.id('job', 'brand'), op: 'brand.decide', status: 'succeeded', owned: ['own-9'] };
  const drawJob = { id: ids.id('job', 'draw'), op: 'interface.draw', status: 'queued', owned: ['own-1'], params: { candidatesPerScreen: 1, gateRounds: 5 } };
  return { workflow: { id: WORKFLOW, phase: 'running', goalRevision: 0 }, jobs: [brandJob, drawJob], tree: { brand: true },
    live: { kernelStartFailures: failed.length, codexKernelStartFailures: codex.length, lastStep: wordOr(failed.at(-1)?.p.step), lastTerminalNamed: Boolean(failed.at(-1)?.p.terminal), promptChars: 16831, pasteChip: 'Pasted Content' } };
}

/** The leg a Critic hold failed: architecture.decide whose records were finished and whose Critic did not start, and the work.author queued behind it (the facts of case k and l). */
function criticHoldFacts(copy) {
  const db = openLedger(copy, 'nivo');
  const failed = rows(db, "SELECT * FROM jobs WHERE op_id='architecture.decide' AND status='failed' ORDER BY try_no");
  const dependant = first(db, "SELECT * FROM jobs WHERE op_id='work.author' AND status='queued'");
  return { tries: failed.length, dependantQueued: Boolean(dependant), routed: countOf(db, "SELECT count(*) n FROM events WHERE kind='failure-routed'") };
}
const heldLeg = (status, extra = {}) => ({ id: 'job-1', op: 'architecture.decide', status, admitted: status === 'reported', provider: 'claude', owned: ['d1.sds'],
  report: { outcome: 'blocked', blocker: { kind: 'authority' }, cause: 'critic-hold', checks: [{ name: 'check-1' }] }, ...extra });

/** Case k: a failed leg whose own Critic could not start, filed with the closest blocker kind it had, and the work.author held behind it. */
function criticHeld(copy) {
  const facts = criticHoldFacts(copy);
  return { workflow: { id: WORKFLOW, phase: 'running', goalRevision: 0 },
    jobs: [{ ...heldLeg('failed'), admitted: false, result: { verdict: 'blocked', nextStep: null } }, { id: 'job-2', op: 'work.author', status: 'queued', owned: ['own-1'], after: ['job-1'] }],
    tree: { records: ['d1.sds.rec-1'] }, decisions: [], events: [], live: facts };
}

/** Case l: the same leg while its report is still unsettled (reported, held by the Critic). */
function criticHeldReported(copy) {
  const facts = criticHoldFacts(copy);
  return { workflow: { id: WORKFLOW, phase: 'running', goalRevision: 0 }, jobs: [heldLeg('reported', { at: { created: -7_200_000, updated: -3_600_000 } })],
    tree: { records: ['d1.sds.rec-1'] }, decisions: [], events: [], live: facts };
}

const RECIPES = { 'critic-held': criticHeld, 'critic-held-reported': criticHeldReported, 'codex-turn-start': codexTurnStart, 'draw-render-tool': drawRenderTool, 'fenced-retry': fencedRetry, 'grammar-in-tree': grammarInTree, 'leg-ready': legReady, 'read-plan': readPlan, 'shape-guard': shapeGuard, 'handed-over': handedOver, 'prepared-fail': preparedFail };
export const CASES = Object.freeze(Object.keys(RECIPES));

/** The fixture document of `name` extracted from `copy`; the source names the copy neutrally. */
export function extractCase(name, copy) {
  const recipe = RECIPES[name];
  if (!recipe) throw new Error(`unknown case ${name} (known: ${CASES.join(', ')})`);
  try { return { schema: 'replay-fixture@1', case: name, source: { copy: path.basename(copy).replace(/^ledger-copy-/, '') }, ...recipe(copy) }; }
  finally { for (const db of opened.splice(0)) db.close(); }
}

/** Writes the fixture; refuses when the hygiene scan finds anything. Answers {file, bytes}. */
export function writeFixture(name, copy, outDir = FIXTURES) {
  const document = extractCase(name, copy);
  const findings = scanFixture(document);
  if (findings.length) throw new Error(`fixture ${name} is not neutral: ${findings.map((f) => `${f.rule} at ${f.where} (${f.sample})`).join('; ')}`);
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${name}.json`);
  const text = `${JSON.stringify(document, null, 1)}\n`;
  fs.writeFileSync(file, text);
  return { file, bytes: text.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const [name, copy, flag, out] = process.argv.slice(2);
  if (!name || !copy) { console.error(`use: extract.mjs <${CASES.join('|')}> <ledger-copy-dir> [--out <dir>]`); process.exit(2); }
  console.log(JSON.stringify(writeFixture(name, path.resolve(copy), flag === '--out' ? path.resolve(out) : FIXTURES)));
}
