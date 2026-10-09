// critic-run.mjs - the Critic the runtime owes a done report of a decision leg that has no verdict of its own.
//
// A Critic run is independent of the maker by construction (another provider, a clean directory of the product bytes and the rubric), so the
// RUNTIME owes it and the maker never supplies its own judge's verdict: when a done report of a kind the Critic covers (scripts/kernel/critic-settle.mjs
// criticOwedBy) is settled, the settler runs the decision Critic itself over the reported product (scripts/work/decision-critic.mjs critiqueDecision:
// the same picker, guard, rubric and handed bytes) and records the outcome as the ledger event `runtime-critic-run` (who, model, dispatch, duration,
// verdict), once per product digest. A verdict file the op attached is not read: it is recorded once as `runtime-critic-op-verdict-ignored`.
// `starci kernel settle` judges only the verdict this event carries (judgeCriticVerdict `runtime`): a pass passes the gate, a failing critique is the
// op's error-work with the critique attached, and a Critic that could not judge (no independent member, quota, unavailable) is a typed hold of the
// settler, never a refusal; holds are spaced by tail.retryMs and bounded by tail.maxAttempts per digest, after which the settler's checker-unavailable
// path has opened a Supervisor item and the Critic is not launched again for the same bytes.
import crypto from 'node:crypto';
import path from 'node:path';
import { parseJson } from '../../lib/json.mjs';
import { critiqueDecision } from '../../work/decision-critic.mjs';
import { criticRubrics, ownedRelOf, productDigests, productFiles } from '../../work/decision-critic-product.mjs';
import { criticOwedBy } from '../critic-settle.mjs';

/** The ledger event that records one runtime Critic run. */
export const RUNTIME_CRITIC_EVENT = 'runtime-critic-run';
/** The ledger event that records a verdict file an op attached and the settle did not read. */
export const OP_VERDICT_IGNORED_EVENT = 'runtime-critic-op-verdict-ignored';
const WORK_ROOT_NAME = '.starciwork';
const FIELD_MAX = 240;
const SUMMARY_MAX = 400;

const clip = (text, max) => (typeof text === 'string' && text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** The verdict document with its prose bounded, so the event that carries it stays inside the ledger's event size. */
function compactVerdict(document) {
  return { ...document, summary: clip(document.summary, SUMMARY_MAX),
    checks: (document.checks ?? []).map((check) => ({ ...check, evidence: clip(check.evidence, FIELD_MAX), fix: clip(check.fix, FIELD_MAX) })) };
}

/** The newest `runtime-critic-run` event of a job as {at, ...payload}, or null; `digest` narrows to one product digest. */
export function runtimeCriticRunOf(db, jobId, digest = null) {
  const rows = db.prepare('SELECT created_at, payload_json FROM events WHERE entity_id=? AND kind=? ORDER BY seq DESC LIMIT 20').all(jobId, RUNTIME_CRITIC_EVENT);
  const found = rows.map((row) => ({ at: Number(row.created_at), ...parseJson(row.payload_json, {}) })).find((entry) => digest === null || entry.digest === digest);
  return found ?? null;
}

const digestOf = (digests) => crypto.createHash('sha256').update(JSON.stringify([...digests.product, ...digests.inputs].map((entry) => entry.sha256))).digest('hex');

/** The job's attempt row: who made the product (provider and model) and its owned paths. */
function makerOf(db, item) {
  const attempt = db.prepare('SELECT provider, agent, model FROM op_attempts WHERE job_id=? ORDER BY attempt_id DESC LIMIT 1').get(item.jobId);
  const provider = attempt?.provider ?? attempt?.agent ?? null;
  return provider ? { provider: String(provider).toLowerCase(), model: attempt?.model ?? null } : null;
}

/**
 * The terminal the workflow's Kernel sits in: the sender an orchestration command of the runtime's Critic is addressed from (Orca refuses a run-create with no sender
 * terminal: no_active_sender_terminal), or null when none is recorded.
 */
export function kernelTerminalOf(db, workflowId) {
  const row = db.prepare("SELECT value_json FROM signals WHERE scope='kernel' AND key=?").get(workflowId);
  const terminal = parseJson(row?.value_json, null)?.terminal;
  return typeof terminal === 'string' && terminal ? terminal : null;
}

/** How many runs of this product digest ended in a hold (a Critic that could not judge). */
const holdsOf = (db, jobId, digest) => db.prepare("SELECT count(*) n FROM events WHERE entity_id=? AND kind=? AND json_extract(payload_json,'$.digest')=? AND json_extract(payload_json,'$.outcome')='hold'")
  .get(jobId, RUNTIME_CRITIC_EVENT, digest).n;

/** Record once per job that the report attached a Critic verdict the settle does not read (the maker never supplies its own judge's verdict). */
function noteIgnoredVerdict(ledger, item, digest, now) {
  const db = ledger.db;
  const attached = db.prepare("SELECT name FROM job_artifacts WHERE job_id=? AND name LIKE '%critic-verdict%' LIMIT 1").get(item.jobId);
  if (!attached || db.prepare('SELECT 1 FROM events WHERE entity_id=? AND kind=? LIMIT 1').get(item.jobId, OP_VERDICT_IGNORED_EVENT)) return;
  ledger.transaction(() => ledger.appendEvent({ workflowId: item.workflowId, entityType: 'job', entityId: item.jobId, kind: OP_VERDICT_IGNORED_EVENT, createdAt: now, payload: { jobId: item.jobId, op: item.op, digest, file: attached.name } }));
}

/**
 * The Critic run `item` (a reported job: {jobId, workflowId, op, outcome}) is owed, if any. Returns null when none is owed or one already stands for
 * this product digest, `{ran: true, outcome, pass}` after a run that produced a verdict, `{hold: {code, error}}` when the Critic could not judge.
 * `tree` is the workflow's registered tree, `entry` the Kernel's terminal (kernelTerminalOf), `retryMs` the spacing of runs that could not judge,
 * `maxAttempts` the bound of such runs per digest, `critique` the seam (the real Critic, or a fake).
 */
export async function runtimeCriticFor(ledger, item, { tree, entry: coordinator = null, retryMs, maxAttempts = Infinity, now = Date.now(), critique = critiqueDecision, orca = null, rubrics = criticRubrics() }) {
  const entry = item.outcome === 'done' ? criticOwedBy(item.op) : null;
  if (!entry || !tree) return null;
  const workRoot = path.join(tree, WORK_ROOT_NAME);
  const payload = parseJson(ledger.db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(item.jobId)?.payload_json, {}) ?? {};
  const within = (payload.owned_paths ?? []).map((owned) => ownedRelOf(typeof owned === 'string' ? owned : owned?.path)).filter((rel) => rel !== null);
  const scope = within.length ? within : null;
  const product = productFiles({ workRoot, entry, within: scope });
  if (!product.length) return null;
  const digest = digestOf(productDigests({ workRoot, entry, inputs: rubrics.inputs, within: scope }));
  noteIgnoredVerdict(ledger, item, digest, now);
  const prior = runtimeCriticRunOf(ledger.db, item.jobId, digest);
  if (prior?.document) return null;
  const tries = prior ? holdsOf(ledger.db, item.jobId, digest) : 0;
  if (prior && (tries >= maxAttempts || now - prior.at < retryMs)) return { hold: { code: prior.code, error: prior.error } };
  const maker = makerOf(ledger.db, item);
  const { critique: result, document } = await critique({ kind: item.op, workRoot, records: product.map((file) => file.abs), maker: maker ?? undefined, orca, placement: { repoRoot: tree }, ...(coordinator ? { entry: coordinator } : {}) });
  const body = { jobId: item.jobId, op: item.op, digest, maker: maker?.provider ?? null, try: tries + 1,
    critic: { provider: result.critic?.provider ?? null, model: result.critic?.model ?? null, dispatchId: result.critic?.dispatchId ?? null, durationMs: result.critic?.ms ?? null, tokens: result.critic?.tokens ?? null },
    outcome: document ? 'verdict' : 'hold', code: result.code ?? null, error: clip(result.error ?? null, FIELD_MAX), pass: document?.pass ?? null, ...(document ? { document: compactVerdict(document) } : {}) };
  ledger.transaction(() => ledger.appendEvent({ workflowId: item.workflowId, entityType: 'job', entityId: item.jobId, kind: RUNTIME_CRITIC_EVENT, createdAt: now, payload: body }));
  return document ? { ran: true, outcome: body.outcome, pass: body.pass } : { hold: { code: body.code, error: body.error } };
}
