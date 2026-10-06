// contract-version.mjs — immutable operation contract and admission snapshots.
import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from '../../engine/digest.mjs';
import { parseJson } from '../lib/json.mjs';
import { asList, byCodeUnit } from '../lib/list.mjs';
import { headShaOf } from '../lib/git-dir.mjs';

export const CONTRACT_VERSION_SCHEMA = 'starci/contract-version@1';
const ABSENT = 'absent';
const ALWAYS_CITED = ['modules/ops/_common.yaml', 'modules/kernel/verdict-contract.yaml'];
const CITE_RX = /(?:modules\/schemas|scripts\/(?:checks|gates|hfs|work))\/[A-Za-z0-9._/-]+\.(?:ya?ml|mjs|json)/g;

/** The commit the runtime root's HEAD names, read from .git without spawning git; null when unreadable. */
export const runtimeShaOf = (root) => headShaOf(root);

/** The runtime files an op's contract consists of: its brief, the shared documents, and what the brief cites. */
export function contractFilesOf(root, op) {
  const brief = `modules/ops/ops/${op}.yaml`;
  let text = '';
  try { text = fs.readFileSync(path.join(root, brief), 'utf8'); } catch { /* digested as absent */ }
  const cited = [...new Set(text.match(CITE_RX) ?? [])].filter((rel) => !rel.includes('..'));
  return [brief, ...ALWAYS_CITED, ...cited.toSorted(byCodeUnit)].filter((rel, index, all) => all.indexOf(rel) === index);
}

/** The contract version one dispatch admits a leg under (contracts.context_json.contract). */
export function contractVersionOf(root, op, { now = Date.now() } = {}) {
  const files = contractFilesOf(root, op).map((rel) => {
    let digest = ABSENT;
    try { digest = sha256(fs.readFileSync(path.join(root, rel))); } catch { /* absent */ }
    return { path: rel, digest };
  });
  const digest = sha256(files.map((file) => `${file.path}\0${file.digest}\n`).join(''));
  return { schema: CONTRACT_VERSION_SCHEMA, op, runtimeSha: runtimeShaOf(root), digest, files, admittedAt: now };
}

/** The contracts row of a job's newest attempt, or null. */
export const latestContractOf = (db, jobId) => db.prepare('SELECT c.*, a.dispatch_id FROM contracts c JOIN op_attempts a ON a.attempt_id=c.attempt_id WHERE a.job_id=? ORDER BY a.attempt_id DESC LIMIT 1').get(jobId) ?? null;

/**
 * When and under what version a job was admitted: the contracts row of its newest attempt (its recorded
 * version, else the row's created_at). A job never dispatched has no admission yet - it will be
 * admitted under the current contract - and reads {at:null}.
 */
export function admittedContractOf(db, job) {
  // `job` is a jobs row (its newest attempt's contract), or names one dispatch by attempt_id (contracts are keyed by it).
  const row = job?.attempt_id != null ? db.prepare('SELECT * FROM contracts WHERE attempt_id=?').get(job.attempt_id) ?? null
    : job?.job_id ? latestContractOf(db, job.job_id) : null;
  if (!row) return { at: null, source: 'not-admitted', version: null };
  const version = parseJson(row.context_json ?? '')?.contract;
  const recorded = version?.schema === CONTRACT_VERSION_SCHEMA ? version : null;
  return { at: Number.isFinite(recorded?.admittedAt) ? recorded.admittedAt : row.created_at, source: recorded ? 'recorded' : 'contract-row', version: recorded };
}

/** Caller-supplied advisory metadata cannot waive a recorded check result. */
export function classifyChecks(checks) {
  return asList(checks).map((check) => {
    if (!check || typeof check !== 'object') return check;
    const clean = { ...check };
    delete clean.advisory;
    return clean;
  });
}
