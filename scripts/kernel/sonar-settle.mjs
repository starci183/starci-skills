// sonar-settle.mjs - the settle-time Sonar gate of the code-writing ops (knowledge/sonar-gate.yaml enforcedOps).
//
// backend.implement, interface.implement and code.refactor run scripts/gates/sonar-local.mjs on their own change and attach
// its sonar.json. At `starci kernel settle` the runtime reads that summary itself (judgeSummary): it never takes the op's word. The
// judgment is recorded as the runtime check `sonar-gate` (runner settler, authority runtime) on the attempt, so:
//   - a pass with a red judgment is refused (starci kernel settle prints the why code), and the check keeps the attempt from ever
//     counting as green: summarizeCheckEvidence counts it failed;
//   - the settled attempt's why (scripts/kernel/why.mjs) carries the Vietnamese text of the code
//     (modules/kernel/failure-codes.yaml sonar-gate-red | sonar-unavailable | sonar-scan-refused | sonar-proof-missing);
//   - a scan that could not run at all (server down, custody missing) is never a silent pass: it records the explicit
//     `sonar-unavailable` why, an event on the workflow and a runtime-defect incident owned by the Supervisor
//     (scripts/supervisor/poll.mjs lists `[runtime-...]` incidents), and the next passing judgment resolves it.
import fs from 'node:fs';
import path from 'node:path';
import { openIncident, resolveIncident } from '../../engine/db/ledger.mjs';
import { recordCheck } from '../machine/evidence-store.mjs';
import { judgeSummary, loadSonarGate, SCAN_SCHEMA_PREFIX } from '../gates/sonar-gate.mjs';
import { inspectOwnerConfig, specsSettings } from '../../engine/config.mjs';
import { attachedNameOf } from '../lib/display-names.mjs';
import { oneLine } from '../lib/clip.mjs';

export const SONAR_ENFORCE_CHANGE = 'sonar-enforce';
export const SONAR_CHECK = 'sonar-gate';
export const SONAR_INCIDENT_TAG = '[runtime-sonar-unavailable]';
const SUMMARY_MAX_BYTES = 8 * 1024 * 1024;



/**
 * The newest sonar-local scan summary among a job's files ([{abs, name?}] from collectJobFiles), or null. A file counts
 * only when it parses as JSON with a starci/sonar-local-scan schema, whatever it is called: the name only narrows the read.
 */
export function readSonarSummary(files) {
  let best = null;
  for (const file of files ?? []) {
    if (!file?.abs || !/sonar/i.test(attachedNameOf(file)) && !/sonar/i.test(path.basename(file.abs))) continue;
    let doc = null;
    try {
      if (fs.statSync(file.abs).size > SUMMARY_MAX_BYTES) continue;
      doc = JSON.parse(fs.readFileSync(file.abs, 'utf8'));
    } catch { continue; }
    if (!String(doc?.schema ?? '').startsWith(SCAN_SCHEMA_PREFIX)) continue;
    if (!best || String(doc.at ?? '') >= String(best.summary.at ?? '')) best = { summary: doc, file: attachedNameOf(file) };
  }
  return best;
}

/** Whether an op is held to the gate. */
export const enforcesOp = (op, gate = loadSonarGate()) => gate.enforcedOps.includes(op);

/** The judgment of a job's files: {op, judged, file, summary} - judged is judgeSummary's answer. */
export function judgeJob({ op, files, gate = loadSonarGate(), specs = specsSettings(inspectOwnerConfig().config) }) {
  if (!enforcesOp(op, gate)) return null;
  const found = readSonarSummary(files);
  // The owner switches are read here, never taken from the summary: an owner-mode claim stands only while specs.unit is off.
  return { op, judged: judgeSummary(found?.summary ?? null, gate, { specs }), file: found?.file ?? null, summary: found?.summary ?? null };
}



/**
 * Record the judgment on the attempt and, for an unavailable Sonar, tell the Supervisor. Idempotent per attempt: each
 * call adds one runtime check run (run_seq counts them; the latest decides), and an already-open incident of the same
 * workflow is not duplicated. `ledger` is the api ledger handle (transaction, appendEvent, db).
 */
export function recordSonarJudgment(ledger, { workflowId, jobId, opId = null, attemptId, judgment, now = Date.now() }) {
  const { judged } = judgment;
  const green = judged.status === 'pass';
  const evidence = green ? oneLine(judged.note ?? 'the slice meets the Sonar gate') : oneLine(`${judged.code}: ${judged.detail}`);
  const db = ledger.db;
  let incidentId = null;
  ledger.transaction(() => {
    recordCheck(db, { attemptId, name: SONAR_CHECK, phase: 'verify', runner: 'settler', authority: 'runtime',
      command: `sonar-gate settle over ${judgment.file ?? 'no sonar.json'} (knowledge/sonar-gate.yaml)`, exitCode: green ? 0 : 1,
      summary: { codes: judged.code ? [judged.code] : [], evidence, failing: judged.findings, status: judged.status,
        entry: { name: SONAR_CHECK, exitCode: green ? 0 : 1, codes: judged.code ? [judged.code] : [], evidence } }, now });
    if (judged.status === 'unavailable') {
      const open = db.prepare("SELECT incident_id FROM incidents WHERE workflow_id=? AND status='open' AND last_progress LIKE ?").get(workflowId, `${SONAR_INCIDENT_TAG}%`);
      incidentId = open?.incident_id ?? openIncident(db, { workflowId, kind: 'runtime-defect', owner: 'supervisor', opId, jobId, attemptId,
        detail: oneLine(`Sonar could not judge ${opId ?? 'an op'}'s change, so the op cannot settle done: ${judged.detail}`),
        lastProgress: `${SONAR_INCIDENT_TAG} ${oneLine(judged.detail, 200)}`, at: now });
      ledger.appendEvent({ workflowId, entityType: 'job', entityId: jobId, attemptId, kind: 'sonar-unavailable',
        payload: { op: opId, reason: judged.detail, incidentId, why: 'sonar-unavailable' }, createdAt: now });
    } else if (green) {
      // The server answered and the slice is fine: an earlier unavailable notice of this workflow is resolved.
      for (const row of db.prepare("SELECT incident_id FROM incidents WHERE workflow_id=? AND status='open' AND last_progress LIKE ?").all(workflowId, `${SONAR_INCIDENT_TAG}%`))
        resolveIncident(db, { incidentId: row.incident_id, reason: 'fixed', at: now });
    }
  });
  return { checkName: SONAR_CHECK, green, status: judged.status, code: judged.code, evidence, ...(incidentId ? { incidentId } : {}) };
}

/** What `starci kernel settle` prints when it refuses a pass the Sonar gate does not allow. */
export function refusalText(op, judged, jobId) {
  const next = judged.status === 'unavailable'
    ? 'Sonar is unavailable: the Supervisor has been told (a runtime incident). Settle blocked or fail; never pass without the gate.'
    : judged.status === 'red' ? 'Fix the listed findings in the op\'s own change, rerun the slice scan and report again.'
    : 'Rerun sonar-local scan on the change (fresh coverage, --wait) and attach its sonar.json.';
  return `settle REFUSED for ${jobId} (${op}): ${judged.code} - ${judged.detail}; the job stays reported. ${next}`;
}
