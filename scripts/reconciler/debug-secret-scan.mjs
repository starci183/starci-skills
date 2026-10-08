// debug-secret-scan.mjs — the scan seam over the digest's own inputs. Everything the runtime stores of a worker's words is redacted at write
// time (scripts/lib/redact.mjs); this reads the stored artifacts back and runs the SAME rules over them: a rule that still finds a secret in a stored
// text means one survived redaction. A hit names the artifact and the rule and counts the matches; the matched text never leaves this module.
//   inputs  machine_logs rows (message and data), the newest transcript snapshot of each seat, the Supervisor's reports, the final transcript of
//           each op attempt (blob bytes through `readBlob`; a blob the store cannot give is counted unreadable, never guessed)
import { survivingSecrets } from '../lib/redact.mjs';
import { getBlob } from '../../engine/db/blob.mjs';

const decode = (bytes, maxBytes) => Buffer.from(bytes).subarray(0, maxBytes).toString('utf8');

/** The hits of one stored text: [{artifact, kind, rule, count}]. Pure; no matched text. */
export function scanText({ artifact, kind, text }) {
  return survivingSecrets(text).map(({ rule, count }) => ({ artifact, kind, rule, count }));
}

/** The result of scanning `items` ([{artifact, kind, sha}]): {scanned, unreadable, hits}. `readBlob(sha)` returns bytes or throws. */
export function scanBlobs(items, { maxBytes, readBlob = getBlob } = {}) {
  const out = { scanned: 0, unreadable: 0, hits: [] };
  for (const item of items) {
    let text = null;
    try { text = decode(readBlob(item.sha), maxBytes); } catch { text = null; }
    if (text === null) { out.unreadable += 1; continue; }
    out.scanned += 1;
    out.hits.push(...scanText({ artifact: item.artifact, kind: item.kind, text }));
  }
  return out;
}

const ask = (m, sql, args) => { try { return m.db.prepare(sql).all(...args); } catch { return []; } };

/** The blob-backed artifacts of the machine store worth scanning: the newest seat snapshot of every seat and the newest Supervisor reports. */
export function machineBlobItems(m, { limit }) {
  const snapshots = ask(m, `SELECT seat_id, sha256 AS sha FROM seat_transcript_snapshots s
    WHERE snapshot_id=(SELECT MAX(snapshot_id) FROM seat_transcript_snapshots x WHERE x.seat_id=s.seat_id) ORDER BY at DESC LIMIT ?`, [limit])
    .map((r) => ({ artifact: `seat-snapshot:${r.seat_id}`, kind: 'transcript', sha: r.sha }));
  const reports = ask(m, 'SELECT report_id, report_sha AS sha FROM sup_reports WHERE report_sha IS NOT NULL ORDER BY report_id DESC LIMIT ?', [limit])
    .map((r) => ({ artifact: `sup-report:${r.report_id}`, kind: 'report', sha: r.sha }));
  return [...snapshots, ...reports];
}

/** The scan of the newest `limit` machine_logs rows: each row is one artifact (its message and data). */
export function scanLogs(m, { limit }) {
  const rows = ask(m, 'SELECT seq, msg, data_json FROM machine_logs ORDER BY seq DESC LIMIT ?', [limit]);
  const hits = rows.flatMap((r) => scanText({ artifact: `machine-log:${r.seq}`, kind: 'log', text: `${r.msg}\n${r.data_json ?? ''}` }));
  return { scanned: rows.length, unreadable: 0, hits };
}

/** Two scan results as one. */
export const mergeScans = (...parts) => ({ scanned: parts.reduce((n, p) => n + p.scanned, 0), unreadable: parts.reduce((n, p) => n + p.unreadable, 0), hits: parts.flatMap((p) => p.hits) });
