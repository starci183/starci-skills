// work-citations.mjs — how a Work record cites agent output (alpha.3, ARCHITECTURE-DB §5.3).
//
// A Work record (git, .starciwork) never names a file an agent produced: it cites the artifact by its id and the
// bytes by their sha256 - {artifact: <job_artifacts.artifact_id>, sha256: <64 hex>, role?, label?} - anywhere in the
// record (run.screens[0], assets[3], ...). The sha is immutable and travels between machines; the artifact id links
// back to the attempt, model and job that produced it. The harness serves the bytes at /api/blob/<sha256>.
//   citationsOf        every citation of one parsed record, with its field path
//   resolveCitations   CITATION_UNRESOLVED for a sha the ledger has no blob for, or an artifact id it does not know /
//                      that holds other bytes
//   citeRecords        at settle: resolve the cited Work records a job wrote and record work_citations (citeBlob,
//                      which pins the blob so GC never sweeps it)
// A citation to an owner's word (receipt, ownerAcceptance) names decisions.decision_id or an ask id, not a blob.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { citeBlob } from '../../engine/ledger-db.mjs';

export const CITATION_UNRESOLVED = 'CITATION_UNRESOLVED';
export const CITATION_ROLES = Object.freeze(['direction', 'capture', 'uat-screen', 'uat-video', 'uat-result', 'render', 'layout-capture']);
const SHA = /^[a-f0-9]{64}$/;
const slash = (p) => String(p).replace(/\\/g, '/');

/**
 * Every citation in a parsed Work record: [{field, sha256, artifactId, role}]. A citation is an object with a
 * 64-hex `sha256` and either an `artifact` id or no `path` (an object with `path` + `sha256` is a code digest, not a
 * citation of agent output).
 */
export function citationsOf(doc) {
  const out = [];
  const visit = (node, field) => {
    if (Array.isArray(node)) { node.forEach((v, i) => visit(v, `${field}[${i}]`)); return; }
    if (!node || typeof node !== 'object') return;
    if (typeof node.sha256 === 'string' && SHA.test(node.sha256) && (node.artifact != null || node.path == null)) {
      out.push({ field: field || '(root)', sha256: node.sha256, artifactId: Number.isInteger(node.artifact) ? node.artifact : node.artifact != null ? Number(node.artifact) : null,
        role: CITATION_ROLES.includes(node.role) ? node.role : null });
      return;
    }
    for (const [k, v] of Object.entries(node)) visit(v, field ? `${field}.${k}` : k);
  };
  visit(doc, '');
  return out;
}

/** The citations the ledger cannot back: [{field, sha256, artifactId, code, reason}]. */
export function resolveCitations(db, citations) {
  const blob = db.prepare('SELECT 1 FROM blobs WHERE sha256=?');
  const artifact = db.prepare('SELECT sha256 FROM job_artifacts WHERE artifact_id=?');
  const out = [];
  for (const c of citations) {
    let reason = null;
    if (!blob.get(c.sha256)) reason = `no blob ${c.sha256} in this project's ledger`;
    else if (c.artifactId != null) {
      const row = artifact.get(c.artifactId);
      if (!row) reason = `no artifact ${c.artifactId} in this project's ledger`;
      else if (row.sha256 !== c.sha256) reason = `artifact ${c.artifactId} holds ${row.sha256}, not ${c.sha256}`;
    }
    if (reason) out.push({ ...c, code: CITATION_UNRESOLVED, reason });
  }
  return out;
}

/** The record id of a Work record document: its `record` (evidence) or `id`. */
const recordIdOf = (doc) => (typeof doc?.record === 'string' ? doc.record : typeof doc?.id === 'string' ? doc.id : null);

/**
 * Inside the settle transaction: every resolvable citation of the Work records in `files` (repo-relative or
 * absolute .starciwork yaml paths) becomes a work_citations row and pins its blob. Returns {cited, unresolved[]}.
 */
export function citeRecords(db, { repo, files = [], recordRev = null, now = Date.now() }) {
  let cited = 0;
  const unresolved = [];
  for (const file of files) {
    const abs = path.isAbsolute(file) ? file : path.resolve(repo, file);
    if (!/\.ya?ml$/i.test(abs) || !/[\\/]\.starciwork[\\/]/.test(abs)) continue;
    let doc = null;
    try { doc = parseYaml(fs.readFileSync(abs, 'utf8')); } catch { continue; }
    const recordId = recordIdOf(doc);
    const citations = citationsOf(doc);
    if (!recordId || !citations.length) continue;
    const bad = resolveCitations(db, citations);
    const recordPath = slash(path.relative(repo, abs));
    unresolved.push(...bad.map((b) => ({ ...b, recordId, recordPath })));
    const badFields = new Set(bad.map((b) => b.field));
    for (const c of citations) {
      if (badFields.has(c.field)) continue;
      citeBlob(db, { recordId, recordPath, field: c.field, sha256: c.sha256, artifactId: c.artifactId, role: c.role, recordRev, createdAt: now });
      cited += 1;
    }
  }
  return { cited, unresolved };
}
