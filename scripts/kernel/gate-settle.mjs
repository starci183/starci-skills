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
// Beside the loop, the ops of op-gate.yaml `opProofs` owe their mechanism proofs (contract change op-mechanism-proofs), judged
// by judgeProofs from the documents the op attached and recorded as the runtime check `op-proof`:
//   read-knowledge  op-read-digest-missing, op-read-digest-no-knowledge (no knowledge file, or a written record with no slot)
//   doc-gate        op-doc-gate-missing, op-doc-gate-tool-failed, op-doc-gate-red (gate.mjs --profile docs)
//   test-world      op-test-world-proof-missing, op-test-world-hand-rolled, op-test-world-run-red (test-world-run.mjs)
//   unit-kit        op-unit-proof-missing, op-unit-run-red, op-unit-coverage-below, op-unit-kit-violation (unit-run.mjs)
//   security-lint   op-lint-proof-missing, op-lint-tool-failed, op-security-findings-missing, op-security-finding-unreported
//                   (hfs lint --format json, and every security canon finding carried by rule in security-findings.json)
//   fe-lint         op-lint-proof-missing, op-lint-tool-failed, op-lint-findings (hfs lint --format json)
//   review-gate     op-gate-proof-missing, op-gate-tool-failed, op-gate-new-findings (gate.mjs over the reviewed range)
//   review-defects  op-review-defects-missing, op-review-defect-unclassified, op-review-missing-check-unrecorded
//   release         op-release-proof-missing, op-release-step-skipped, op-release-step-red (release-proof.mjs)
// The judgment is recorded as the runtime check `op-gate` (runner settler, authority runtime) on the attempt, so a pass it
// refuses never counts as green, and the settled attempt's why carries the Vietnamese text of the code
// (modules/kernel/failure-codes.yaml).
import fs from 'node:fs';
import path from 'node:path';
import { recordCheck } from './evidence-store.mjs';
import { DOC_PROFILE, GATE_EXIT, GATE_SCHEMA, LINT_SCHEMA } from '../checks/gate.mjs';
import { DIGEST_SCHEMA, judgeKnowledgeDigest, judgeReadDigest, kindsOf, loadOpGate, loopOps } from '../checks/read-digest.mjs';
import { TEST_WORLD_RUN_SCHEMA, testWorldFindings } from '../checks/test-world-run.mjs';
import { UNIT_RUN_SCHEMA, unitFindings } from '../checks/unit-run.mjs';
import { RELEASE_PROOF_SCHEMA, RELEASE_STEPS, STEP_STATUS } from '../checks/release-proof.mjs';

export const OP_GATE_CHANGE = 'op-gate-loop';
export const OP_GATE_CHECK = 'op-gate';
export const OP_PROOF_CHANGE = 'op-mechanism-proofs';
export const OP_PROOF_CHECK = 'op-proof';
export const REVIEW_DEFECTS_SCHEMA = 'starci/review-defects@1';
export const SECURITY_FINDINGS_SCHEMA = 'starci/security-findings@1';
export const DEFECT_CLASS_VALUES = Object.freeze(['business', 'non-business']);
const DOC_MAX_BYTES = 16 * 1024 * 1024;
const FINDINGS_LISTED = 40;

const nameOf = (file) => String(file.name ?? path.basename(String(file.abs ?? ''))).replace(/\\/g, '/');
const oneLine = (text, n = 380) => String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/**
 * The newest JSON document of `schema` among a job's files ([{abs, name?}] from collectJobFiles), or null. A file counts only
 * when it parses as JSON carrying that schema, whatever it is called.
 */
export function readAttached(files, schema, accept = () => true) {
  let best = null;
  for (const file of files ?? []) {
    if (!file?.abs || !/\.json$/i.test(file.abs)) continue;
    let doc = null;
    try {
      if (fs.statSync(file.abs).size > DOC_MAX_BYTES) continue;
      doc = JSON.parse(fs.readFileSync(file.abs, 'utf8'));
    } catch { continue; }
    if (doc?.schema !== schema || !accept(doc)) continue;
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
  const gate = readAttached(files, GATE_SCHEMA, (g) => !isDocGate(g));
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

// ---- mechanism proofs (op-gate.yaml proofs/opProofs, contract change op-mechanism-proofs) ----

const pass = () => ({ status: 'pass', code: null, detail: null, findings: [] });
const refused = ({ status, code }, detail, findings = []) => ({ status, code, detail, findings: findings.slice(0, FINDINGS_LISTED) });
const listed = (rows) => rows.map((f) => `${f.path ?? '-'}${f.line ? `:${f.line}` : ''} ${f.rule ?? f.engine ?? ''} ${oneLine(f.message, 200)}`.trim());
const isDocGate = (doc) => doc?.profile === DOC_PROFILE;
const nameOfDefect = (d) => oneLine(d?.id ?? d?.title ?? JSON.stringify(d), 160);

/** The proofs an op owes for this dispatch: the proof ids of op-gate.yaml opProofs, a `modes` entry kept only for its modes. */
export function proofsOf(op, { mode = null, doc = loadOpGate() } = {}) {
  const entries = doc.opProofs?.[op] ?? [];
  return entries.map((e) => (typeof e === 'string' ? { proof: e, modes: null } : { proof: String(e.proof), modes: e.modes ?? null }))
    .filter((e) => !e.modes || !mode || e.modes.includes(mode)).map((e) => e.proof);
}

/** The ops held to a mechanism proof. */
export const proofOps = (doc = loadOpGate()) => new Set(Object.keys(doc.opProofs ?? {}));

export function judgeKnowledgeRead(digest) {
  const read = judgeKnowledgeDigest(digest);
  if (read.status === 'missing') return refused({ status: 'missing', code: 'op-read-digest-missing' }, `${read.detail}: the op decided or authored without READ (node scripts/checks/read-digest.mjs --root <app> [--touch <records>] --knowledge <knowledge files> --out read-digest.json)`);
  if (read.status !== 'pass') return refused({ status: 'red', code: 'op-read-digest-no-knowledge' }, read.detail);
  return pass();
}

export function judgeDocGate(gate) {
  if (!gate || gate.schema !== GATE_SCHEMA || !isDocGate(gate)) return refused({ status: 'missing', code: 'op-doc-gate-missing' }, `no document gate (schema ${GATE_SCHEMA}, profile ${DOC_PROFILE}) is attached: run node scripts/checks/gate.mjs --profile docs [--tree <app>/.starciwork] --out doc-gate.json`);
  if (gate.exit === GATE_EXIT.toolFailed || (gate.errors ?? []).length) return refused({ status: 'unavailable', code: 'op-doc-gate-tool-failed' }, `a document check could not run: ${oneLine((gate.errors ?? []).join('; ') || `exit ${gate.exit}`)}`, (gate.errors ?? []).map(String));
  const findings = Array.isArray(gate.findings) ? gate.findings : [];
  if (gate.exit !== GATE_EXIT.clean || findings.length) return refused({ status: 'red', code: 'op-doc-gate-red' }, `${findings.length} document finding(s); first: ${listed(findings)[0] ?? `exit ${gate.exit}`}`, listed(findings));
  return pass();
}

export function judgeTestWorld(summary) {
  if (!summary || summary.schema !== TEST_WORLD_RUN_SCHEMA) return refused({ status: 'missing', code: 'op-test-world-proof-missing' }, `no test-world run summary (schema ${TEST_WORLD_RUN_SCHEMA}) is attached: run node scripts/checks/test-world-run.mjs --root <app> --project e2e|integration --out test-world-run.json`);
  // The runtime re-derives the findings from the recorded harness and specs: a summary with its findings list emptied still fails.
  const findings = testWorldFindings(summary);
  if (findings.length) return refused({ status: 'red', code: 'op-test-world-hand-rolled' }, `${findings.length} test-world finding(s); first: ${listed(findings)[0]}`, listed(findings));
  const run = summary.run;
  if (!run || run.error || run.exit !== 0 || !(run.total > 0) || run.failed > 0 || run.skipped > 0)
    return refused({ status: 'red', code: 'op-test-world-run-red' }, run ? `the ${summary.project} run is not green: exit ${run.exit}, ${run.total} test(s), ${run.failed} failed, ${run.skipped} skipped${run.error ? ` (${oneLine(run.error, 200)})` : ''}` : 'the summary records no run',
      (run?.failures ?? []).map((f) => `${f.file} ${f.test}: ${oneLine(f.message, 160)}`));
  return pass();
}

export function judgeUnitRun(summary) {
  if (!summary || summary.schema !== UNIT_RUN_SCHEMA) return refused({ status: 'missing', code: 'op-unit-proof-missing' }, `no unit run summary (schema ${UNIT_RUN_SCHEMA}) is attached: run node scripts/checks/unit-run.mjs --root <app> --out unit-run.json`);
  const run = summary.run;
  if (!run || run.error || run.failed > 0 || !(run.total > 0))
    return refused({ status: 'red', code: 'op-unit-run-red' }, run ? `the unit run is not green: exit ${run.exit}, ${run.total} test(s), ${run.failed} failed${run.error ? ` (${oneLine(run.error, 200)})` : ''}` : 'the summary records no run',
      (run?.failures ?? []).map((f) => `${f.file} ${f.test}: ${oneLine(f.message, 160)}`));
  const findings = unitFindings(summary);
  const coverage = findings.filter((f) => f.rule === 'coverage-below' || f.rule === 'spec-missing');
  if (coverage.length) return refused({ status: 'red', code: 'op-unit-coverage-below' }, `${coverage.length} service(s) below 100 or without a spec; first: ${listed(coverage)[0]}`, listed(coverage));
  const kit = findings.filter((f) => f.rule === 'kit');
  if (kit.length) return refused({ status: 'red', code: 'op-unit-kit-violation' }, `${kit.length} service spec finding(s) off the kit; first: ${listed(kit)[0]}`, listed(kit));
  if (run.exit !== 0) return refused({ status: 'red', code: 'op-unit-run-red' }, `the unit run exited ${run.exit}`);
  return pass();
}

/** A lint judgment over the findings `relevant` keeps (the security codes, or the fe/ side). */
export function judgeLint(report, relevant, what) {
  if (!report || report.schema !== LINT_SCHEMA) return refused({ status: 'missing', code: 'op-lint-proof-missing' }, `no hfs lint report (schema ${LINT_SCHEMA}) is attached: run hfs lint --format json at the app root and attach lint.json`);
  if ((report.errors ?? []).length) return refused({ status: 'unavailable', code: 'op-lint-tool-failed' }, `hfs lint could not run: ${oneLine(report.errors.join('; '))}`, report.errors.map(String));
  const findings = (report.findings ?? []).filter(relevant);
  if (findings.length) return refused({ status: 'red', code: 'op-lint-findings' }, `${findings.length} ${what} finding(s); first: ${listed(findings)[0]}`, listed(findings));
  return pass();
}

const ruleName = (rule) => String(rule ?? '').split('/').pop();
/** Whether a lint finding is one of the security canon: its code in securityCodes or its rule in securityRules. */
export const securityRelevant = (doc = loadOpGate()) => {
  const codes = new Set(doc.securityCodes ?? []);
  const rules = new Set(doc.securityRules ?? []);
  return (f) => codes.has(f.code) || rules.has(ruleName(f.rule));
};
export const feRelevant = (f) => String(f.path ?? '').replace(/\\/g, '/').startsWith('fe/');

const posixOf = (p) => String(p ?? '').replace(/\\/g, '/');
/**
 * The security verdict: the lint ran, and every security canon finding it reports is carried in the op's own findings
 * (starci/security-findings@1 {findings: [{rule, code, path, line, severity, reachability}]}) by path and by code or rule. A
 * security verdict may carry findings - they go to a separate repair - but it may never drop one the canon reported.
 */
export function judgeSecurityLint(report, findingsDoc, relevant) {
  const ran = judgeLint(report, () => false, 'security');
  if (ran.status !== 'pass') return ran;
  if (!findingsDoc || findingsDoc.schema !== SECURITY_FINDINGS_SCHEMA || !Array.isArray(findingsDoc.findings))
    return refused({ status: 'missing', code: 'op-security-findings-missing' }, `no typed security findings (schema ${SECURITY_FINDINGS_SCHEMA}, findings[] by rule, empty when there are none) are attached beside lint.json`);
  const carried = findingsDoc.findings.map((f) => ({ path: posixOf(f?.path), code: f?.code ?? null, rule: ruleName(f?.rule) }));
  const dropped = (report.findings ?? []).filter(relevant).filter((f) => {
    const p = posixOf(f.path);
    return !carried.some((c) => c.path === p && ((f.code && c.code === f.code) || (c.rule && c.rule === ruleName(f.rule))));
  });
  if (dropped.length) return refused({ status: 'red', code: 'op-security-finding-unreported' }, `${dropped.length} security canon finding(s) of the lint are missing from the report's findings; first: ${listed(dropped)[0]}`, listed(dropped));
  return pass();
}

export function judgeReviewGate(gate) {
  if (!gate || gate.schema !== GATE_SCHEMA || isDocGate(gate)) return refused({ status: 'missing', code: 'op-gate-proof-missing' }, `no gate JSON (schema ${GATE_SCHEMA}) over the reviewed range is attached: run node scripts/checks/gate.mjs --root <app> --base <first reviewed commit>^ --out gate.json`);
  if (gate.exit === GATE_EXIT.toolFailed || (gate.errors ?? []).length) return refused({ status: 'unavailable', code: 'op-gate-tool-failed' }, `the gate could not run a tool: ${oneLine((gate.errors ?? []).join('; ') || `exit ${gate.exit}`)}`, (gate.errors ?? []).map(String));
  const fresh = Array.isArray(gate.findings) ? gate.findings : [];
  if (gate.exit !== GATE_EXIT.clean || Number(gate.counts?.new ?? fresh.length) > 0)
    return refused({ status: 'red', code: 'op-gate-new-findings' }, `the reviewed range has ${gate.counts?.new ?? fresh.length} new finding(s) over ${String(gate.base ?? '').slice(0, 12)}: a review cannot pass it`, listed(fresh));
  return pass();
}

export function judgeReviewDefects(doc) {
  if (!doc || doc.schema !== REVIEW_DEFECTS_SCHEMA || !Array.isArray(doc.defects)) return refused({ status: 'missing', code: 'op-review-defects-missing' }, `no defect classification (schema ${REVIEW_DEFECTS_SCHEMA}, defects[], empty when the review found none) is attached`);
  const unclassified = doc.defects.filter((d) => !DEFECT_CLASS_VALUES.includes(d?.class));
  if (unclassified.length) return refused({ status: 'red', code: 'op-review-defect-unclassified' }, `${unclassified.length} defect(s) not classified business or non-business; first: ${nameOfDefect(unclassified[0])}`, unclassified.map(nameOfDefect));
  const filled = (v) => typeof v === 'string' && v.trim().length > 0;
  const uncaught = doc.defects.filter((d) => d.class === 'non-business' && !filled(d.caughtBy) && !filled(d.missingCheck?.check));
  if (uncaught.length) return refused({ status: 'red', code: 'op-review-missing-check-unrecorded' }, `${uncaught.length} non-business defect(s) that no check caught carry no missingCheck for .claude; first: ${nameOfDefect(uncaught[0])}`, uncaught.map(nameOfDefect));
  return pass();
}

export function judgeRelease(proof) {
  if (!proof || proof.schema !== RELEASE_PROOF_SCHEMA || !Array.isArray(proof.steps)) return refused({ status: 'missing', code: 'op-release-proof-missing' }, `no release proof (schema ${RELEASE_PROOF_SCHEMA}) is attached: run node scripts/checks/release-proof.mjs --repo <repo> --base <range start>^ --out release-proof.json`);
  const byId = new Map(proof.steps.map((s) => [s?.id, s]));
  const skipped = RELEASE_STEPS.filter((id) => !byId.has(id) || byId.get(id)?.status === STEP_STATUS.skipped);
  if (skipped.length) return refused({ status: 'red', code: 'op-release-step-skipped' }, `release step(s) missing or skipped: ${skipped.join(', ')}`, skipped.map((id) => `${id} ${oneLine(byId.get(id)?.detail ?? 'not run', 200)}`));
  const red = RELEASE_STEPS.filter((id) => byId.get(id)?.status !== STEP_STATUS.pass);
  if (red.length) return refused({ status: 'red', code: 'op-release-step-red' }, `release step(s) not green: ${red.map((id) => `${id} (${byId.get(id)?.status})`).join(', ')}`, red.map((id) => `${id} ${oneLine(byId.get(id)?.detail, 200)}`));
  return pass();
}

/** The judgment of one proof over a job's files. */
export function judgeProof(proof, files, doc = loadOpGate()) {
  const read = (schema, accept) => readAttached(files, schema, accept)?.doc ?? null;
  switch (proof) {
    case 'read-knowledge': return judgeKnowledgeRead(read(DIGEST_SCHEMA));
    case 'doc-gate': return judgeDocGate(read(GATE_SCHEMA, isDocGate));
    case 'test-world': return judgeTestWorld(read(TEST_WORLD_RUN_SCHEMA));
    case 'unit-kit': return judgeUnitRun(read(UNIT_RUN_SCHEMA));
    case 'security-lint': return judgeSecurityLint(read(LINT_SCHEMA), read(SECURITY_FINDINGS_SCHEMA), securityRelevant(doc));
    case 'fe-lint': return judgeLint(read(LINT_SCHEMA), feRelevant, 'fe/');
    case 'review-gate': return judgeReviewGate(read(GATE_SCHEMA, (g) => !isDocGate(g)));
    case 'review-defects': return judgeReviewDefects(read(REVIEW_DEFECTS_SCHEMA));
    case 'release': return judgeRelease(read(RELEASE_PROOF_SCHEMA));
    default: throw new Error(`knowledge/op-gate.yaml opProofs names an unknown proof ${proof}`);
  }
}

/**
 * The proof judgment of a job: {op, proofs[], proof, judged} - judged is the first refusal in proof order, else a pass; null when
 * the op owes no proof for this mode.
 */
export function judgeJobProofs({ op, files, mode = null, doc = loadOpGate() }) {
  const owed = proofsOf(op, { mode, doc });
  if (!owed.length) return null;
  for (const proof of owed) {
    const judged = judgeProof(proof, files, doc);
    if (judged.status !== 'pass') return { op, proofs: owed, proof, judged };
  }
  return { op, proofs: owed, proof: null, judged: pass() };
}

/** Record the proof judgment on the attempt as the runtime check op-proof. Each call adds one check run; the latest decides. */
export function recordProofJudgment(ledger, { attemptId, judgment, now = Date.now() }) {
  const { judged } = judgment;
  const green = judged.status === 'pass';
  const evidence = green ? `the mechanism proofs hold: ${judgment.proofs.join(', ')}` : oneLine(`${judgment.proof}: ${judged.code}: ${judged.detail}`);
  ledger.transaction(() => recordCheck(ledger.db, { attemptId, name: OP_PROOF_CHECK, phase: 'verify', runner: 'settler', authority: 'runtime',
    command: `op-proof settle over ${judgment.proofs.join(', ')} (knowledge/op-gate.yaml opProofs)`, exitCode: green ? 0 : 1,
    summary: { codes: judged.code ? [judged.code] : [], evidence, failing: judged.findings, status: judged.status,
      entry: { name: OP_PROOF_CHECK, exitCode: green ? 0 : 1, codes: judged.code ? [judged.code] : [], evidence } }, now }));
  return { checkName: OP_PROOF_CHECK, green, status: judged.status, code: judged.code, evidence };
}

/** What `api settle` prints when it refuses a done a mechanism proof does not allow. */
export function proofRefusalText(op, judgment, jobId, doc = loadOpGate()) {
  const { judged, proof } = judgment;
  const script = doc.proofs?.[proof]?.script;
  return `settle REFUSED for ${jobId} (${op}): ${judged.code} - ${judged.detail}; the job stays reported. The ${proof} proof is mandatory for ${op} (knowledge/op-gate.yaml opProofs): ${script ? `run ${script}, ` : ''}fix what it reports and attach its document, or settle blocked or failed with these findings; never done.`;
}
