// critic-run-record.mjs — what the ledger keeps of the Critic's runs. The draw loop keeps its critique in the round file of the op's
// scratch; when an interface.draw pass settles, the runtime reads the best round of every loop the pass's ui records name and appends one
// `critic-run` event per loop (once per job and loop): the Critic's provider and model, the provider of the op that made the product,
// whether they differ, the typed code of a refusal, how many product digests the verdict judged and whether a score was used.
// `starci debug digest` answers "did each Critic run on another provider than the op" from these events.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { drawAcceptanceFindings, jobBoundFiles } from './draw/draw-acceptance.mjs';
import { livePartsOf, loopFileOfRef, loopLabelOf } from './draw/draw-loop-coverage.mjs';

const CRITIC_RUN_EVENT = 'critic-run';
const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };

/** The loops of a ui record: [{label, loop}] for every live part that was drawn through the draw loop. */
function loopsOfRecord(repo, rel) {
  const dir = path.dirname(path.resolve(repo, rel));
  let record = null;
  try { record = parseYaml(fs.readFileSync(path.join(dir, 'index.yaml'), 'utf8')); } catch { return []; }
  const seen = new Map();
  for (const part of livePartsOf(dir, record)) {
    const label = loopLabelOf(part.asset.generation?.loop);
    const file = loopFileOfRef(part.asset.generation?.loop);
    if (label && file && !seen.has(label)) seen.set(label, readJson(file));
  }
  return [...seen].filter(([, loop]) => loop).map(([label, loop]) => ({ label, loop }));
}

/** The payload of one critic-run event from the best round of a loop, or null when the round names no critic. */
export function criticRunPayload({ label, loop }, job, opProvider) {
  const round = (loop.rounds ?? []).find((r) => r.n === loop.best?.n) ?? (loop.rounds ?? []).at(-1);
  const critic = round?.critic;
  if (!critic) return null;
  const independent = Boolean(critic.provider && opProvider) && String(critic.provider).toLowerCase() !== String(opProvider).toLowerCase();
  return { jobId: job.job_id, opId: job.op_id, loop: label, criticProvider: critic.provider ?? null, criticModel: critic.model ?? null, opProvider: opProvider ?? null,
    independent, code: critic.code ?? null, error: critic.error ?? null, judged: (critic.judged ?? []).length, used: Number.isFinite(round.beauty) };
}

/** Append one `critic-run` event per draw loop the settled job's ui records name, once each. Never throws; returns the payloads recorded. */
export function recordSettledCriticRuns(ledger, job, repo) {
  if (job.op_id !== 'interface.draw') return [];
  try {
    const db = ledger.db;
    const bound = jobBoundFiles(db, job.job_id);
    const files = (bound?.files ?? []).filter((f) => typeof f === 'string' && !f.includes(':')).map((f) => (path.isAbsolute(f) ? f : path.resolve(repo, f)));
    const opProvider = db.prepare('SELECT provider FROM op_attempts WHERE job_id=? ORDER BY attempt_id DESC LIMIT 1').get(job.job_id)?.provider ?? null;
    const recorded = [];
    for (const rel of drawAcceptanceFindings({ repo, files }).records) {
      for (const entry of loopsOfRecord(repo, rel)) {
        const payload = criticRunPayload(entry, job, opProvider);
        const seen = payload && db.prepare("SELECT 1 FROM events WHERE workflow_id=? AND kind=? AND entity_id=? AND json_extract(payload_json,'$.loop')=? LIMIT 1").get(job.workflow_id, CRITIC_RUN_EVENT, job.job_id, payload.loop);
        if (!payload || seen) continue;
        ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id, kind: CRITIC_RUN_EVENT, payload });
        recorded.push(payload);
      }
    }
    return recorded;
  } catch { return []; }
}
