// The existing specialized mechanism judgments and their qualified native evidence.
import { recordCheck } from '../machine/evidence-store.mjs';
import { DOC_PROFILE, GATE_EXIT, GATE_SCHEMA, LINT_SCHEMA } from '../gates/gate.mjs';
import { DIGEST_SCHEMA, judgeKnowledgeDigest, loadOpGate } from '../gates/read-digest.mjs';
import { TEST_WORLD_RUN_SCHEMA, testRunCountsError, testWorldFindings } from '../gates/test-world-run.mjs';
import { UNIT_RUN_SCHEMA, unitFindings } from '../gates/unit-run.mjs';
import { RELEASE_PROOF_SCHEMA, RELEASE_STEPS, STEP_STATUS } from '../gates/release-proof.mjs';
import { oneLine } from '../lib/clip.mjs';
import { slash } from '../lib/path-key.mjs';
import { readAttached, readAllAttached } from './attached-proof.mjs';
import { judgeFiledRead } from './mechanism-observation.mjs';

const OP_PROOF_CHECK = 'op-proof';
export const REVIEW_DEFECTS_SCHEMA = 'starci/review-defects@1';
export const SECURITY_FINDINGS_SCHEMA = 'starci/security-findings@1';
const DEFECT_CLASS_VALUES = Object.freeze(['business', 'non-business']);
const FINDINGS_LISTED = 40;
// ---- mechanism proofs (op-gate.yaml proofs/opProofs) ----

const pass = () => ({ status: 'pass', code: null, detail: null, findings: [] });
const refused = ({ status, code }, detail, findings = []) => ({ status, code, detail, findings: findings.slice(0, FINDINGS_LISTED) });
const listed = (rows) => rows.map((f) => `${f.path ?? '-'}${f.line ? ':' + f.line : ''} ${f.rule ?? f.engine ?? ''} ${oneLine(f.message, 200)}`.trim());
/** Whether the shared gate document measures the document profile. */
export const isDocGate = (doc) => doc?.profile === DOC_PROFILE;
const nameOfDefect = (d) => oneLine(d?.id ?? d?.title ?? JSON.stringify(d), 160);

/** The proof entries an op owes for this dispatch ([{proof, projects}]): op-gate.yaml opProofs, a `modes` entry kept only for its modes. */
export function proofEntriesOf(op, { mode = null, doc = loadOpGate() } = {}) {
  const entries = doc.opProofs?.[op] ?? [];
  return entries.map((e) => (typeof e === 'string' ? { proof: e, modes: null, projects: [] } : { proof: String(e.proof), modes: e.modes ?? null, projects: e.projects ?? [] }))
    .filter((e) => !e.modes || !mode || e.modes.includes(mode)).map(({ proof, projects }) => ({ proof, projects }));
}
/** The proof ids an op owes for this dispatch. */
export const proofsOf = (op, opts = {}) => proofEntriesOf(op, opts).map((e) => e.proof);

/**
 * The test-world judgment over every attached summary: each required project has a summary (the newest of that project is
 * judged), and every other attached summary is judged too, so a red contract run beside a green integration run still refuses.
 */
export function judgeTestWorlds(summaries, projects = []) {
  const newest = new Map();
  for (const s of summaries) if (s?.schema === TEST_WORLD_RUN_SCHEMA && !newest.has(s.project)) newest.set(s.project, s);
  const missing = projects.filter((p) => !newest.has(p));
  if (!newest.size || missing.length) return refused({ status: 'missing', code: 'op-test-world-proof-missing' }, `no test-world run summary (schema ${TEST_WORLD_RUN_SCHEMA}) of project ${(missing.length ? missing : projects).join(', ') || 'any'} is attached: run starci gate test-world --root <app> --project ${(missing[0] ?? projects[0] ?? 'e2e')} --out test-world-run.json`);
  for (const project of [...projects, ...[...newest.keys()].filter((p) => !projects.includes(p))]) {
    const judged = judgeTestWorld(newest.get(project));
    if (judged.status !== 'pass') return judged;
  }
  return pass();
}

export function judgeKnowledgeRead(digest) {
  const read = judgeKnowledgeDigest(digest);
  if (read.status === 'missing') return refused({ status: 'missing', code: 'op-read-digest-missing' }, `${read.detail}: the op decided or authored without READ (starci gate read --root <app> [--touch <records>] --knowledge <knowledge files> --out read-digest.json)`);
  if (read.status !== 'pass') return refused({ status: 'red', code: 'op-read-digest-no-knowledge' }, read.detail);
  return pass();
}

export function judgeDocGate(gate) {
  if (gate?.schema !== GATE_SCHEMA || !isDocGate(gate)) return refused({ status: 'missing', code: 'op-doc-gate-missing' }, `no document gate (schema ${GATE_SCHEMA}, profile ${DOC_PROFILE}) is attached: run starci gate run --scope docs [--tree <app>/.starciwork] --out doc-gate.json`);
  if (gate.exit === GATE_EXIT.toolFailed || (gate.errors ?? []).length) return refused({ status: 'unavailable', code: 'op-doc-gate-tool-failed' }, `a document check could not run: ${oneLine((gate.errors ?? []).join('; ') || 'exit ' + gate.exit)}`, (gate.errors ?? []).map(String));
  const findings = Array.isArray(gate.findings) ? gate.findings : [];
  if (gate.exit !== GATE_EXIT.clean || findings.length) return refused({ status: 'red', code: 'op-doc-gate-red' }, `${findings.length} document finding(s); first: ${listed(findings)[0] ?? 'exit ' + gate.exit}`, listed(findings));
  return pass();
}

export function judgeTestWorld(summary) {
  if (summary?.schema !== TEST_WORLD_RUN_SCHEMA) return refused({ status: 'missing', code: 'op-test-world-proof-missing' }, `no test-world run summary (schema ${TEST_WORLD_RUN_SCHEMA}) is attached: run starci gate test-world --root <app> --project e2e|integration --out test-world-run.json`);
  // The runtime re-derives the findings from the recorded harness and specs: a summary with its findings list emptied still fails.
  const findings = testWorldFindings(summary);
  if (findings.length) return refused({ status: 'red', code: 'op-test-world-hand-rolled' }, `${findings.length} test-world finding(s); first: ${listed(findings)[0]}`, listed(findings));
  const run = summary.run;
  const runError = run?.error ? ` (${oneLine(run.error, 200)})` : '';
  const runDetail = run ? `the ${summary.project} run is not green: exit ${run.exit}, ${run.total} test(s), ${run.failed} failed, ${run.skipped} skipped${runError}` : 'the summary records no run';
  if (!run || run.error || testRunCountsError(run) || run.exit !== 0 || !(run.total > 0) || !(run.files > 0) || run.failed > 0 || run.failedFiles > 0 || run.skipped > 0)
    return refused({ status: 'red', code: 'op-test-world-run-red' }, runDetail,
      (run?.failures ?? []).map((f) => `${f.file} ${f.test}: ${oneLine(f.message, 160)}`));
  return pass();
}

export function judgeUnitRun(summary) {
  if (summary?.schema !== UNIT_RUN_SCHEMA) return refused({ status: 'missing', code: 'op-unit-proof-missing' }, `no unit run summary (schema ${UNIT_RUN_SCHEMA}) is attached: run starci gate unit --root <app> --out unit-run.json`);
  const run = summary.run;
  const runError = run?.error ? ` (${oneLine(run.error, 200)})` : '';
  const runDetail = run ? `the unit run is not green: exit ${run.exit}, ${run.total} test(s), ${run.failed} failed, ${run.skipped} skipped${runError}` : 'the summary records no run';
  if (!run || run.error || testRunCountsError(run) || run.failed > 0 || run.failedFiles > 0 || run.skipped > 0 || !(run.total > 0) || !(run.files > 0))
    return refused({ status: 'red', code: 'op-unit-run-red' }, runDetail,
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
  if (report?.schema !== LINT_SCHEMA) return refused({ status: 'missing', code: 'op-lint-proof-missing' }, `no starci app lint report (schema ${LINT_SCHEMA}) is attached: run starci app lint --format json at the app root and attach lint.json`);
  if ((report.errors ?? []).length) return refused({ status: 'unavailable', code: 'op-lint-tool-failed' }, `starci app lint could not run: ${oneLine(report.errors.join('; '))}`, report.errors.map(String));
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
export const feRelevant = (f) => String(f.path ?? '').replaceAll('\\', '/').startsWith('fe/');

/**
 * The security verdict: the lint ran, and every security canon finding it reports is carried in the op's own findings
 * (starci/security-findings@1 {findings: [{rule, code, path, line, severity, reachability}]}) by path and by code or rule. A
 * security verdict may carry findings - they go to a separate repair - but it may never drop one the canon reported.
 */
export function judgeSecurityLint(report, findingsDoc, relevant) {
  const ran = judgeLint(report, () => false, 'security');
  if (ran.status !== 'pass') return ran;
  if (findingsDoc?.schema !== SECURITY_FINDINGS_SCHEMA || !Array.isArray(findingsDoc.findings))
    return refused({ status: 'missing', code: 'op-security-findings-missing' }, `no typed security findings (schema ${SECURITY_FINDINGS_SCHEMA}, findings[] by rule, empty when there are none) are attached beside lint.json`);
  const carried = findingsDoc.findings.map((f) => ({ path: slash(f?.path), code: f?.code ?? null, rule: ruleName(f?.rule) }));
  const dropped = (report.findings ?? []).filter(relevant).filter((f) => {
    const p = slash(f.path);
    return !carried.some((c) => c.path === p && ((f.code && c.code === f.code) || (c.rule && c.rule === ruleName(f.rule))));
  });
  if (dropped.length) return refused({ status: 'red', code: 'op-security-finding-unreported' }, `${dropped.length} security canon finding(s) of the lint are missing from the report's findings; first: ${listed(dropped)[0]}`, listed(dropped));
  return pass();
}


// Only the native exit-1 inspection exception uses this stricter carriage. The
// public legacy judge above retains its admitted path/code-or-rule judgment.
function judgeInspectionCarriage(report, findingsDoc, relevant) {
  const ran = judgeLint(report, () => false, 'security');
  if (ran.status !== 'pass') return ran;
  const filled = (value) => typeof value === 'string' && value.trim().length > 0;
  const complete = (f) => f && filled(f.rule) && Object.hasOwn(f, 'code') && (f.code === null || filled(f.code))
    && filled(f.path) && Number.isInteger(f.line) && f.line > 0 && filled(f.severity) && filled(f.reachability);
  if (findingsDoc?.schema !== SECURITY_FINDINGS_SCHEMA || !Array.isArray(findingsDoc.findings) || !findingsDoc.findings.every(complete))
    return refused({ status: 'red', code: 'op-security-findings-missing' }, 'the native inspection requires complete typed findings: rule, code (null only when the lint has no code), path, line, severity and reachability');
  const carried = findingsDoc.findings, used = new Set();
  const dropped = (report.findings ?? []).filter(relevant).filter((f) => {
    // Consume each carried location once: one path/rule row cannot cover two
    // reported locations or duplicate observations of the same location.
    const index = carried.findIndex((c, i) => !used.has(i) && slash(c.path) === slash(f.path)
      && c.line === f.line && c.code === (f.code ?? null) && ruleName(c.rule) === ruleName(f.rule));
    if (index < 0) return true;
    used.add(index); return false;
  });
  if (dropped.length) return refused({ status: 'red', code: 'op-security-finding-unreported' },
    `${dropped.length} security canon finding(s) lack exact typed carriage at their reported location; first: ${listed(dropped)[0]}`, listed(dropped));
  return pass();
}

export function judgeReviewGate(gate) {
  if (gate?.schema !== GATE_SCHEMA || isDocGate(gate)) return refused({ status: 'missing', code: 'op-gate-proof-missing' }, `no gate JSON (schema ${GATE_SCHEMA}) over the reviewed range is attached: run starci gate run --root <app> --base <first reviewed commit>^ --out gate.json`);
  if (gate.exit === GATE_EXIT.toolFailed || (gate.errors ?? []).length) return refused({ status: 'unavailable', code: 'op-gate-tool-failed' }, `the gate could not run a tool: ${oneLine((gate.errors ?? []).join('; ') || 'exit ' + gate.exit)}`, (gate.errors ?? []).map(String));
  const fresh = Array.isArray(gate.findings) ? gate.findings : [];
  if (gate.exit !== GATE_EXIT.clean || Number(gate.counts?.new ?? fresh.length) > 0)
    return refused({ status: 'red', code: 'op-gate-new-findings' }, `the reviewed range has ${gate.counts?.new ?? fresh.length} new finding(s) over ${String(gate.base ?? '').slice(0, 12)}: a review cannot pass it`, listed(fresh));
  return pass();
}

export function judgeReviewDefects(doc) {
  if (doc?.schema !== REVIEW_DEFECTS_SCHEMA || !Array.isArray(doc.defects)) return refused({ status: 'missing', code: 'op-review-defects-missing' }, `no defect classification (schema ${REVIEW_DEFECTS_SCHEMA}, defects[], empty when the review found none) is attached`);
  const unclassified = doc.defects.filter((d) => !DEFECT_CLASS_VALUES.includes(d?.class));
  if (unclassified.length) return refused({ status: 'red', code: 'op-review-defect-unclassified' }, `${unclassified.length} defect(s) not classified business or non-business; first: ${nameOfDefect(unclassified[0])}`, unclassified.map(nameOfDefect));
  const filled = (v) => typeof v === 'string' && v.trim().length > 0;
  const uncaught = doc.defects.filter((d) => d.class === 'non-business' && !filled(d.caughtBy) && !filled(d.missingCheck?.check));
  if (uncaught.length) return refused({ status: 'red', code: 'op-review-missing-check-unrecorded' }, `${uncaught.length} non-business defect(s) that no check caught carry no missingCheck for .claude; first: ${nameOfDefect(uncaught[0])}`, uncaught.map(nameOfDefect));
  return pass();
}

export function judgeRelease(proof) {
  if (proof?.schema !== RELEASE_PROOF_SCHEMA || !Array.isArray(proof.steps)) return refused({ status: 'missing', code: 'op-release-proof-missing' }, `no release proof (schema ${RELEASE_PROOF_SCHEMA}) is attached: run starci release proof --repo <repo> --base <range start>^ --out release-proof.json`);
  const byId = new Map(proof.steps.map((s) => [s?.id, s]));
  const skipped = RELEASE_STEPS.filter((id) => !byId.has(id) || byId.get(id)?.status === STEP_STATUS.skipped);
  if (skipped.length) return refused({ status: 'red', code: 'op-release-step-skipped' }, `release step(s) missing or skipped: ${skipped.join(', ')}`, skipped.map((id) => `${id} ${oneLine(byId.get(id)?.detail ?? 'not run', 200)}`));
  const red = RELEASE_STEPS.filter((id) => byId.get(id)?.status !== STEP_STATUS.pass);
  if (red.length) return refused({ status: 'red', code: 'op-release-step-red' }, `release step(s) not green: ${red.map((id) => id + ' (' + byId.get(id)?.status + ')').join(', ')}`, red.map((id) => `${id} ${oneLine(byId.get(id)?.detail, 200)}`));
  return pass();
}

/** A security inspection records findings, with the real lint exit retained. This
 * exception is only the canonical lint runner of security.verify, not a generic
 * failing command or a delivery gate. Typed carriage is judged independently. */
export function judgeInspectionRun(run, files, doc = loadOpGate()) {
  if (run?.native?.schema !== LINT_SCHEMA || !run.native.stable || run.native.process?.status !== 1
      || run.native.process.error || run.native.process.signal || run.exitCode !== 1 || run.status === 'unavailable'
      || !Array.isArray(run.output?.findings) || !run.output.findings.length || !Array.isArray(run.output?.errors))
    return refused({ status: 'unavailable', code: 'op-lint-tool-failed' }, 'the inspection has no complete native lint observation');
  return judgeInspectionCarriage(run.output, readAttached(files, SECURITY_FINDINGS_SCHEMA)?.doc, securityRelevant(doc));
}

const mechanicalSchema = (proof, doc) => doc.proofs?.[proof]?.schema;
const matching = (proof, observations, doc) => observations.filter((row) => row.native?.schema === mechanicalSchema(proof, doc)
  && (proof !== 'doc-gate' || row.native.profile === DOC_PROFILE)
  && (proof !== 'review-gate' || row.native.profile !== DOC_PROFILE));

/** Judge the existing attachment obligations with native output deciding each
 * executable result. Manual defect/typed findings remain declared review inputs. */
function judgeCurrentProof(proof, files, doc, { op, projects, observations, context }) {
  if (proof === 'review-defects') return judgeProof(proof, files, doc, { projects });
  const rows = matching(proof, observations, doc);
  // An attachment still has to be filed, but its green shape cannot replace a
  // missing, red, stale or unavailable native producer.
  const attached = readAttached(files, mechanicalSchema(proof, doc), (value) => proof !== 'doc-gate' || isDocGate(value));
  if (!attached || !rows.length) return judgeProof(proof, [], doc, { projects });
  const broken = rows.find((row) => row.judged);
  if (broken) return broken.judged;
  const failed = rows.find((row) => row.exitCode !== 0);
  if (failed && !(proof === 'security-lint' && op === 'security.verify' && rows.every((row) => row.exitCode === 0 || row.exitCode === 1))) return refused({ status: 'red', code: 'op-gate-new-findings' }, `the native ${proof} producer exited ${failed.exitCode}`);
  if (proof === 'read-knowledge') {
    const knowledge = judgeKnowledgeRead(attached.doc);
    if (knowledge.status !== 'pass') return knowledge;
    return judgeFiledRead(attached.doc, context, doc, observations) ?? pass();
  }
  if (proof === 'test-world') return judgeTestWorlds(rows.map((row) => row.doc), projects);
  for (const row of rows) {
    const judged = judgedProofRow(proof, row, files, doc);
    if (judged.status !== 'pass') return judged;
  }
  return pass();
}

/** The specialized judgment of one native proof row. */
const judgedProofRow = (proof, row, files, doc) => {
  switch (proof) {
    case 'doc-gate': return judgeDocGate(row.doc);
    case 'unit-kit': return judgeUnitRun(row.doc);
    case 'security-lint': return row.exitCode === 1
      ? judgeInspectionCarriage(row.doc, readAttached(files, SECURITY_FINDINGS_SCHEMA)?.doc, securityRelevant(doc))
      : judgeSecurityLint(row.doc, readAttached(files, SECURITY_FINDINGS_SCHEMA)?.doc, securityRelevant(doc));
    case 'fe-lint': return judgeLint(row.doc, feRelevant, 'fe/');
    case 'produced-lint': return judgeLint(row.doc, () => true, 'produced-file');
    case 'review-gate': return judgeReviewGate(row.doc);
    case 'release': return judgeRelease(row.doc);
    default: throw new Error(`unknown mechanical proof ${proof}`);
  }
};

/** The judgment of one proof over a job's files. */
function judgeProof(proof, files, doc = loadOpGate(), { projects = [] } = {}) {
  const read = (schema, accept) => readAttached(files, schema, accept)?.doc ?? null;
  switch (proof) {
    case 'read-knowledge': return judgeKnowledgeRead(read(DIGEST_SCHEMA));
    case 'doc-gate': return judgeDocGate(read(GATE_SCHEMA, isDocGate));
    case 'test-world': return judgeTestWorlds(readAllAttached(files, TEST_WORLD_RUN_SCHEMA).map((a) => a.doc), projects);
    case 'unit-kit': return judgeUnitRun(read(UNIT_RUN_SCHEMA));
    case 'security-lint': return judgeSecurityLint(read(LINT_SCHEMA), read(SECURITY_FINDINGS_SCHEMA), securityRelevant(doc));
    case 'fe-lint': return judgeLint(read(LINT_SCHEMA), feRelevant, 'fe/');
    case 'produced-lint': return judgeLint(read(LINT_SCHEMA), () => true, 'produced-file');
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
export function judgeJobProofs({ op, files, mode = null, doc = loadOpGate(), observations = [], context = null }) {
  const entries = proofEntriesOf(op, { mode, doc });
  if (!entries.length) return null;
  const owed = entries.map((e) => e.proof);
  const nativeRows = context && Array.isArray(observations) ? observations : [];
  for (const { proof, projects } of entries) {
    const judged = judgeCurrentProof(proof, files, doc, { op, projects, observations: nativeRows, context });
    if (judged.status !== 'pass') return { op, proofs: owed, proof, judged };
  }
  const used = nativeRows.filter((row) => entries.some(({ proof }) => proof !== 'review-defects' && matching(proof, [row], doc).length));
  return { op, proofs: owed, proof: null, judged: pass(), nativeCheckIds: used.map((row) => row.checkId),
    inspectionCheckIds: op === 'security.verify' ? used.filter((row) => row.native.schema === LINT_SCHEMA && row.exitCode === 1).map((row) => row.checkId) : [],
    bindings: used.filter((row) => !row.judged).map((row) => row.native) };
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

/** What `starci kernel settle` prints when it refuses a done a mechanism proof does not allow. */
export function proofRefusalText(op, judgment, jobId, doc = loadOpGate()) {
  const { judged, proof } = judgment;
  const script = doc.proofs?.[proof]?.script;
  return `settle REFUSED for ${jobId} (${op}): ${judged.code} - ${judged.detail}; the job stays reported. The ${proof} proof is mandatory for ${op} (knowledge/op-gate.yaml opProofs): ${script ? 'run ' + script + ', ' : ''}fix what it reports and attach its document, or settle blocked or failed with these findings; never done.`;
}
