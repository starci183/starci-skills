// failure-class.mjs - which of the two classes a job failure belongs to, decided by the evidence and the failure-code catalog
// (modules/kernel/failure-codes.yaml `kind`), never by the Kernel's label. A failing check on the op's own product is work
// (policy row error-work: the Kernel retries, switches agent, re-plans); a typed refusal code the catalog classes runtime-fault is a
// runtime fault (policy row error-runtime-defect). The Kernel's menu withholds the escape for a work failure that still has retries,
// and a supervisor-gate of cause runtime-defect over work evidence is refused (verbs/shared/gate-raise.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { boundValue } from './op-incident-policy.mjs';

const CLASS_OF_KIND = Object.freeze({ 'check-finding': 'work', 'runtime-fault': 'runtime' });
const CODE = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b|\b[a-z][a-z0-9]*(?:-[a-z0-9]+)+\b/g;
const RETRY_BOUND = { ref: 'modules/models/kinds.yaml#routes[id=rejected-report-retries].limit' };
let catalog = null;

const catalogOf = () => (catalog ??= parseYaml(fs.readFileSync(path.join(skillRoot, 'modules', 'kernel', 'failure-codes.yaml'), 'utf8')));

/** 'work' | 'runtime' for a catalogued code whose kind decides the class, else null. */
export const classOfCode = (code) => CLASS_OF_KIND[catalogOf()[code]?.kind] ?? null;

/** The catalogued codes a text names, each with its class. */
const codesIn = (text) => [...new Set(String(text ?? '').match(CODE) ?? [])].map((code) => ({ code, class: classOfCode(code) })).filter((entry) => entry.class);

const refusalTexts = (db, jobId) => db.prepare("SELECT payload_json FROM events WHERE entity_type='job' AND entity_id=? AND (kind LIKE '%-refused' OR kind LIKE '%needs-kernel' OR kind='job-result') ORDER BY seq DESC LIMIT 8").all(jobId).map((row) => row.payload_json);

const failedCheckCount = (db, jobId) => db.prepare(`SELECT count(*) n FROM check_runs WHERE job_id=? AND status='fail'
  AND attempt_id=(SELECT max(attempt_id) FROM check_runs WHERE job_id=?)`).get(jobId, jobId).n;

/**
 * The class the evidence of one job decides: {class: 'work'|'runtime'|'unknown', codes, failedChecks}. A runtime-fault code anywhere
 * in the refusals or the result wins; a failing check on the latest attempt, or only work-class codes, is work; nothing decisive is unknown.
 */
export function failureClassOf(db, jobId) {
  const codes = refusalTexts(db, jobId).flatMap((text) => codesIn(text));
  const failedChecks = failedCheckCount(db, jobId);
  const decided = failedChecks > 0 || codes.length > 0 ? 'work' : 'unknown';
  return { class: codes.some((entry) => entry.class === 'runtime') ? 'runtime' : decided, codes, failedChecks };
}

/** Retries of the unit's lineage still owed by policy row error-work (the rejected-report limit minus the retries already made). */
export function workRetriesLeft(db, jobId) {
  const tries = db.prepare('SELECT try_no FROM jobs WHERE job_id=?').get(jobId)?.try_no ?? 1;
  return Math.max(0, boundValue(RETRY_BOUND) - (tries - 1));
}

/** The facts the Kernel's menu and the gate raise share: {class, codes, failedChecks, retriesLeft}. */
export function failureFactsOf(db, jobId) {
  const facts = failureClassOf(db, jobId);
  return { ...facts, retriesLeft: workRetriesLeft(db, jobId) };
}

/** Jobs of a gate's scope whose evidence says work: the scope the runtime-defect cause cannot hold. */
export const workClassedJobs = (db, jobIds) => jobIds.filter((jobId) => failureClassOf(db, jobId).class === 'work');
