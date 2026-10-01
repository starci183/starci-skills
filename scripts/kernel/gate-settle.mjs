// gate-settle.mjs - the settle-time half of the op loop (knowledge/op-gate.yaml enforcedOps), enforced the way the Sonar gate is
// (scripts/kernel/sonar-settle.mjs).
//
// Every enforced op runs READ-CODE-CHECK-FIX-REPORT: it records a READ digest (scripts/checks/read-digest.mjs) before coding,
// forces scripts/checks/gate.mjs every round, and attaches the last gate JSON and the digest to its report. At `api settle`
// the runtime re-reads both itself - never the op's word - and resolves the kinds of the gate's changed files with the app's own
// `hfs explain`. It refuses a done when:
//   op-gate-proof-missing     no gate JSON (schema starci/gate@1) is attached
//   op-gate-tool-failed       the gate could not run a tool (exit 2): never a pass
//   op-gate-new-findings      the gate reports findings the base does not have (lint, tsc, failing specs)
//   op-read-digest-missing    no READ digest (schema starci/read-digest@1) is attached: the op skipped READ
//   op-read-digest-no-pattern the digest names no pattern file for a touched file kind
// The judgment is recorded as the runtime check `op-gate` (runner settler, authority runtime) on the attempt, so a pass it
// refuses never counts as green, and the settled attempt's why carries the Vietnamese text of the code
// (modules/kernel/failure-codes.yaml).
import fs from 'node:fs';
import path from 'node:path';
import { recordCheck } from './evidence-store.mjs';
import { GATE_EXIT, GATE_SCHEMA } from '../checks/gate.mjs';
import { DIGEST_SCHEMA, judgeReadDigest, kindsOf, loadOpGate, loopOps } from '../checks/read-digest.mjs';

export const OP_GATE_CHANGE = 'op-gate-loop';
export const OP_GATE_CHECK = 'op-gate';
const DOC_MAX_BYTES = 16 * 1024 * 1024;
const FINDINGS_LISTED = 40;

const nameOf = (file) => String(file.name ?? path.basename(String(file.abs ?? ''))).replace(/\\/g, '/');
const oneLine = (text, n = 380) => String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/**
 * The newest JSON document of `schema` among a job's files ([{abs, name?}] from collectJobFiles), or null. A file counts only
 * when it parses as JSON carrying that schema, whatever it is called.
 */
export function readAttached(files, schema) {
  let best = null;
  for (const file of files ?? []) {
    if (!file?.abs || !/\.json$/i.test(file.abs)) continue;
    let doc = null;
    try {
      if (fs.statSync(file.abs).size > DOC_MAX_BYTES) continue;
      doc = JSON.parse(fs.readFileSync(file.abs, 'utf8'));
    } catch { continue; }
    if (doc?.schema !== schema) continue;
    if (!best || String(doc.at ?? '') >= String(best.doc.at ?? '')) best = { doc, file: nameOf(file) };
  }
  return best;
}

/**
 * What the attached gate JSON and READ digest say, as a settle judgment {status, code, detail, findings[]}. `kinds` is
 * [{path, slot}] of the gate's changed files as the runtime resolved them.
 */
export function judgeLoop({ gate, digest, kinds, doc = loadOpGate() }) {
  if (!gate || gate.schema !== GATE_SCHEMA)
    return { status: 'missing', code: 'op-gate-proof-missing', detail: `no gate JSON (schema ${GATE_SCHEMA}) is attached to the report: run node scripts/checks/gate.mjs --changed ... --out gate.json and attach it`, findings: [] };
  if (gate.exit === GATE_EXIT.toolFailed || (gate.errors ?? []).length)
    return { status: 'unavailable', code: 'op-gate-tool-failed', detail: `the gate could not run a tool: ${oneLine((gate.errors ?? []).join('; ') || `exit ${gate.exit}`)}`, findings: (gate.errors ?? []).map(String) };
  const fresh = Array.isArray(gate.findings) ? gate.findings : [];
  if (gate.exit !== GATE_EXIT.clean || Number(gate.counts?.new ?? fresh.length) > 0) {
    const listed = fresh.slice(0, FINDINGS_LISTED).map((f) => `${f.path ?? '-'}${f.line ? `:${f.line}` : ''} ${f.engine}/${f.rule} ${oneLine(f.message, 160)}`);
    return { status: 'red', code: 'op-gate-new-findings', detail: `${gate.counts?.new ?? fresh.length} new finding(s) over base ${String(gate.base ?? '').slice(0, 12)}; first: ${listed[0] ?? `exit ${gate.exit}`}`, findings: listed };
  }
  const read = judgeReadDigest(digest, kinds, doc);
  if (read.status === 'missing') return { status: 'missing', code: 'op-read-digest-missing', detail: `${read.detail}: the op skipped READ (node scripts/checks/read-digest.mjs --touch ... --out read-digest.json)`, findings: [] };
  if (read.status === 'no-pattern') return { status: 'red', code: 'op-read-digest-no-pattern', detail: read.detail, findings: read.uncovered.map((u) => `${u.path ?? '-'} ${u.slot ?? 'unknown kind'} owes one of ${u.owed.join(', ') || 'knowledge/patterns/**'}`) };
  return { status: 'pass', code: null, detail: null, findings: [] };
}

/** Whether an op is held to the loop. */
export const enforcesLoop = (op, doc = loadOpGate()) => loopOps(doc).has(op);

/**
 * The judgment of a job's files: {op, judged, gateFile, digestFile} - null when the op is not held to the loop. `roots` are the
 * job's placement roots: the kinds are resolved in the gate's root when it is one of them (else the first root).
 */
export async function judgeJobLoop({ op, files, roots = [], doc = loadOpGate() }) {
  if (!enforcesLoop(op, doc)) return null;
  const gate = readAttached(files, GATE_SCHEMA);
  const digest = readAttached(files, DIGEST_SCHEMA);
  let kinds = [];
  if (gate?.doc?.changed?.length) {
    const known = roots.map((r) => path.resolve(r));
    const gateRoot = gate.doc.root && known.some((r) => r.toLowerCase() === path.resolve(gate.doc.root).toLowerCase()) ? path.resolve(gate.doc.root) : known[0] ?? (gate.doc.root ? path.resolve(gate.doc.root) : null);
    kinds = gateRoot && fs.existsSync(gateRoot) ? await kindsOf(gateRoot, gate.doc.changed) : gate.doc.changed.map((p) => ({ path: p, slot: null }));
  }
  return { op, judged: judgeLoop({ gate: gate?.doc ?? null, digest: digest?.doc ?? null, kinds, doc }), gateFile: gate?.file ?? null, digestFile: digest?.file ?? null };
}

/** Record the judgment on the attempt as the runtime check op-gate. Each call adds one check run; the latest decides. */
export function recordLoopJudgment(ledger, { attemptId, judgment, now = Date.now() }) {
  const { judged } = judgment;
  const green = judged.status === 'pass';
  const evidence = green ? 'the op gate is green and the READ digest covers every touched file kind' : oneLine(`${judged.code}: ${judged.detail}`);
  ledger.transaction(() => recordCheck(ledger.db, { attemptId, name: OP_GATE_CHECK, phase: 'verify', runner: 'settler', authority: 'runtime',
    command: `op-gate settle over ${judgment.gateFile ?? 'no gate.json'} + ${judgment.digestFile ?? 'no read-digest.json'} (knowledge/op-gate.yaml)`, exitCode: green ? 0 : 1,
    summary: { codes: judged.code ? [judged.code] : [], evidence, failing: judged.findings, status: judged.status,
      entry: { name: OP_GATE_CHECK, exitCode: green ? 0 : 1, codes: judged.code ? [judged.code] : [], evidence } }, now }));
  return { checkName: OP_GATE_CHECK, green, status: judged.status, code: judged.code, evidence };
}

/** What `api settle` prints when it refuses a done the loop does not allow. */
export function loopRefusalText(op, judged, jobId) {
  const next = judged.code === 'op-gate-tool-failed' ? 'A gate tool could not run: fix the environment cause and rerun the gate, or settle blocked; never done without a gate.'
    : judged.code === 'op-gate-new-findings' ? 'Fix the listed findings and rerun the gate, up to params.gateRounds rounds; still red after the last round is blocked with these findings.'
    : judged.code?.startsWith('op-read-digest') ? 'READ before coding: run scripts/checks/read-digest.mjs over the touched files, read what it lists and attach read-digest.json.'
    : 'Run scripts/checks/gate.mjs over the change and attach its gate.json.';
  return `settle REFUSED for ${jobId} (${op}): ${judged.code} - ${judged.detail}; the job stays reported. ${next}`;
}
