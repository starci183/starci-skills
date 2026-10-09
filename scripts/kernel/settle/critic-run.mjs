// critic-run.mjs - the Critic the runtime owes a done report of a decision leg that has no verdict of its own.
//
// A Critic run is independent of the maker by construction (another provider, a clean directory of the product bytes and the rubric), so the
// RUNTIME can owe it: when a done report of a kind the Critic covers (scripts/kernel/critic-settle.mjs criticOwedBy) carries no verdict the op
// attached - the job was admitted before the rule, or the op's own Critic run hit a happy error - the settler runs the decision Critic itself over
// the reported product (scripts/work/decision-critic.mjs critiqueDecision: the same picker, guard, rubric and handed bytes) and records the outcome as
// the ledger event `runtime-critic-run`, once per product digest. `starci kernel settle` then judges the verdict this event carries exactly as it
// judges an attached one (judgeCriticVerdict `runtime`): a pass passes the gate, a failing critique is the op's error-work with the critique
// attached, and a Critic that could not judge (no independent member, quota, unavailable) is a typed hold of the settler, never a refusal.
import crypto from 'node:crypto';
import path from 'node:path';
import { parseJson } from '../../lib/json.mjs';
import { critiqueDecision } from '../../work/decision-critic.mjs';
import { criticRubrics, ownedRelOf, productDigests, productFiles } from '../../work/decision-critic-product.mjs';
import { criticOwedBy } from '../critic-settle.mjs';

/** The ledger event that records one runtime Critic run. */
export const RUNTIME_CRITIC_EVENT = 'runtime-critic-run';
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

/** Whether the job's report already attaches a Critic verdict of its own (the op ran the Critic): the runtime owes none then. */
const attachesVerdict = (db, jobId) => db.prepare("SELECT 1 FROM job_artifacts WHERE job_id=? AND name LIKE '%critic-verdict%' LIMIT 1").get(jobId) != null;

/**
 * The Critic run `item` (a reported job: {jobId, workflowId, op, outcome}) is owed, if any. Returns null when none is owed or one already stands for
 * this product digest, `{ran: true, outcome, pass}` after a run that produced a verdict, `{hold: {code, error}}` when the Critic could not judge.
 * `tree` is the workflow's registered tree, `retryMs` the spacing of runs that could not judge, `critique` the seam (the real Critic, or a fake).
 */
export async function runtimeCriticFor(ledger, item, { tree, retryMs, now = Date.now(), critique = critiqueDecision, orca = null, rubrics = criticRubrics() }) {
  const entry = item.outcome === 'done' ? criticOwedBy(item.op) : null;
  if (!entry || !tree || attachesVerdict(ledger.db, item.jobId)) return null;
  const workRoot = path.join(tree, WORK_ROOT_NAME);
  const payload = parseJson(ledger.db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(item.jobId)?.payload_json, {}) ?? {};
  const within = (payload.owned_paths ?? []).map((owned) => ownedRelOf(typeof owned === 'string' ? owned : owned?.path)).filter((rel) => rel !== null);
  const scope = within.length ? within : null;
  const product = productFiles({ workRoot, entry, within: scope });
  if (!product.length) return null;
  const digest = digestOf(productDigests({ workRoot, entry, inputs: rubrics.inputs, within: scope }));
  const prior = runtimeCriticRunOf(ledger.db, item.jobId, digest);
  if (prior?.document) return null;
  if (prior && now - prior.at < retryMs) return { hold: { code: prior.code, error: prior.error } };
  const maker = makerOf(ledger.db, item);
  const { critique: result, document } = await critique({ kind: item.op, workRoot, records: product.map((file) => file.abs), maker: maker ?? undefined, orca, placement: { repoRoot: tree } });
  const body = { jobId: item.jobId, op: item.op, digest, maker: maker?.provider ?? null, critic: { provider: result.critic?.provider ?? null, model: result.critic?.model ?? null },
    outcome: document ? 'verdict' : 'hold', code: result.code ?? null, error: clip(result.error ?? null, FIELD_MAX), pass: document?.pass ?? null, ...(document ? { document: compactVerdict(document) } : {}) };
  ledger.transaction(() => ledger.appendEvent({ workflowId: item.workflowId, entityType: 'job', entityId: item.jobId, kind: RUNTIME_CRITIC_EVENT, createdAt: now, payload: body }));
  return document ? { ran: true, outcome: body.outcome, pass: body.pass } : { hold: { code: body.code, error: body.error } };
}
