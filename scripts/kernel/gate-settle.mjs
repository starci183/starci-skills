// gate-settle.mjs - the settle-time half of the op loop (knowledge/op-gate.yaml enforcedOps), enforced the way the Sonar gate is
// (scripts/kernel/sonar-settle.mjs).
//
// Every enforced op runs READ-CODE-CHECK-FIX-REPORT: it records a READ digest (scripts/gates/read-digest.mjs) before coding,
// forces `starci gate run` every round, and attaches the last gate JSON and the digest to its report. At `starci kernel settle`
// the runtime re-reads both itself - never the op's word - and resolves the kinds of the gate's changed files with the app's own
// `starci app explain`. It refuses a done when:
//   op-gate-proof-missing     no gate JSON (schema starci/gate@1) is attached
//   op-gate-tool-failed       the gate could not run a tool (exit 2): never a pass
//   op-gate-new-findings      the gate reports findings the base does not have (lint, tsc, failing specs)
//   op-read-digest-missing    no READ digest (schema starci/read-digest@1) is attached: the op skipped READ
//   op-read-digest-no-pattern the digest names no pattern file for a touched file kind
// Beside the loop, the ops of op-gate.yaml `opProofs` owe their mechanism proofs, judged
// by the existing specialized judges, reexported here from mechanism-proofs.mjs. Current admitted legs need bound native check_runs, with attachments retained for READ/manual obligations, recorded as `op-proof`:
//   read-knowledge  op-read-digest-missing, op-read-digest-no-knowledge (no knowledge file, or a written record with no slot)
//   doc-gate        op-doc-gate-missing, op-doc-gate-tool-failed, op-doc-gate-red (starci gate run --scope docs)
//   test-world      op-test-world-proof-missing, op-test-world-hand-rolled, op-test-world-run-red (test-world-run.mjs)
//   unit-kit        op-unit-proof-missing, op-unit-run-red, op-unit-coverage-below, op-unit-kit-violation (unit-run.mjs)
//   security-lint   op-lint-proof-missing, op-lint-tool-failed, op-security-findings-missing, op-security-finding-unreported
//                   (starci app lint --format json, and every security canon finding carried by rule in security-findings.json)
//   fe-lint,
//   produced-lint   op-lint-proof-missing, op-lint-tool-failed, op-lint-findings (starci app lint --format json: fe/ findings of an audit,
//                   any finding over the files a drawing or an asset op produced)
//   review-gate     op-gate-proof-missing, op-gate-tool-failed, op-gate-new-findings (gate.mjs over the reviewed range)
//   review-defects  op-review-defects-missing, op-review-defect-unclassified, op-review-missing-check-unrecorded
//   release         op-release-proof-missing, op-release-step-skipped, op-release-step-red (release-proof.mjs)
// The judgment is recorded as the runtime check `op-gate` (runner settler, authority runtime) on the attempt, so a pass it
// refuses never counts as green, and the settled attempt's why carries the Vietnamese text of the code
// (modules/kernel/failure-codes.yaml).
import fs from 'node:fs';
import path from 'node:path';
import { recordCheck } from '../machine/evidence-store.mjs';
import { GATE_EXIT, GATE_SCHEMA, LINT_SCHEMA, gateInputSnapshot } from '../gates/gate.mjs';
import { DIGEST_SCHEMA, buildReadDigest, judgeReadDigest, kindsOf, loadOpGate, loopOps } from '../gates/read-digest.mjs';
import { TEST_WORLD_RUN_SCHEMA } from '../gates/test-world-run.mjs';
import { UNIT_RUN_SCHEMA } from '../gates/unit-run.mjs';
import { RELEASE_PROOF_SCHEMA } from '../gates/release-proof.mjs';
import { readAttached } from './attached-proof.mjs';
import { proofEntriesOf, isDocGate } from './mechanism-proofs.mjs';
export { REVIEW_DEFECTS_SCHEMA, SECURITY_FINDINGS_SCHEMA, proofsOf, judgeTestWorlds, judgeKnowledgeRead, judgeDocGate,
  judgeTestWorld, judgeUnitRun, judgeLint, securityRelevant, feRelevant, judgeSecurityLint, judgeReviewGate, judgeReviewDefects,
  judgeRelease, judgeJobProofs, recordProofJudgment, proofRefusalText } from './mechanism-proofs.mjs';
import { oneLine } from '../lib/clip.mjs';
import { byCodeUnit } from '../lib/list.mjs';
import { normRel, sameResolvedPath } from '../lib/path-key.mjs';
import { isAncestor } from '../api/git/is-ancestor.mjs';
import { revParse } from '../api/git/rev-parse.mjs';
import { APP_SCOPE, SIDES, locateDeclaration } from '../hfs/slots.mjs';

const OP_GATE_CHECK = 'op-gate';
const FINDINGS_LISTED = 40;

/**
 * Capture each resolved placement's HEAD and exact owned scope before a provider can edit it. Unknown placement or Git
 * identity refuses admission; the existing packet/contract carries these inputs through the attempt without a new store.
 */
export function captureGateBinding(placements, { at, revision = (root) => revParse(root, 'HEAD') } = {}) {
  if (!Array.isArray(placements) || !placements.length) throw new Error('the admitted job has no resolved target placement');
  const targets = [];
  for (const place of placements) {
    if (place.unresolved || !place.base || !place.path) throw new Error('the job has an unresolved target placement');
    const root = path.resolve(place.base), owned = normRel(place.path);
    if (!owned || path.isAbsolute(owned) || owned === '..' || owned.startsWith('../')) throw new Error('the job has an invalid owned path');
    let target = targets.find((row) => sameResolvedPath(row.root, root));
    if (!target) {
      const head = revision(root);
      if (!/^[0-9a-f]{40,64}$/.test(String(head ?? ''))) throw new Error(`the target Git baseline is unavailable: ${root}`);
      target = { root, head, owned: [] }; targets.push(target);
    }
    if (!target.owned.includes(owned)) target.owned.push(owned);
  }
  for (const target of targets) target.owned.sort();
  return { at, targets };
}

/**
 * What the attached gate JSON and READ digest say, as a settle judgment {status, code, detail, findings[]}. `kinds` is
 * [{path, slot}] of the gate's changed files as the runtime resolved them.
 */
// The 'unavailable' detail a current-bound gate earns, or null: wrong target, base or HEAD, a malformed
// or repeated input entry, an owned input the gate dropped or changed silently, or a READ/CHECK pair out of order.
const currentGateProblem = (gate, snapshot, digest) => {
  if (!snapshot || !Array.isArray(gate.inputs) || !Array.isArray(gate.changed))
    return 'the gate has no independently bound current input snapshot';
  if (typeof gate.root !== 'string' || !/^[0-9a-f]{40,64}$/.test(String(gate.head ?? '')) || !sameResolvedPath(gate.root, snapshot.root)
    || gate.base !== snapshot.base || !isAncestor(snapshot.root, gate.head, snapshot.head))
    return 'the gate belongs to another target, base or unrelated HEAD; rerun CHECK';
  const inputs = new Map();
  for (const file of gate.inputs) {
    if (typeof file?.path !== 'string' || (file.sha256 !== null && !/^[0-9a-f]{64}$/.test(String(file.sha256 ?? ''))) || inputs.has(file.path))
      return 'the gate input list contains a missing, malformed or repeated entry';
    inputs.set(file.path, file.sha256);
  }
  const changed = new Set(gate.changed);
  for (const file of snapshot.inputs) {
    if (!inputs.has(file.path) || inputs.get(file.path) !== file.sha256 || (file.sha256 !== null && !changed.has(file.path)))
      return `the gate omitted or no longer matches owned input ${file.path}; rerun CHECK`;
  }
  if (digest && (!Number.isFinite(Date.parse(gate.at)) || !Number.isFinite(Date.parse(digest.at)) || Date.parse(digest.at) > Date.parse(gate.at)))
    return 'READ and CHECK do not have an ordered recorded attempt';
  return null;
};

export function judgeLoop({ gate, digest, kinds, doc = loadOpGate(), gateBases = [], current = false, snapshot = null, expectedRead = null }) {
  if (gate?.schema !== GATE_SCHEMA)
    return { status: 'missing', code: 'op-gate-proof-missing', detail: `no gate JSON (schema ${GATE_SCHEMA}) is attached to the report: run starci gate run --changed ... --out gate.json and attach it`, findings: [] };
  // In a workflow worktree the gate must measure against a checkpoint the op's side has not moved since
  // (scripts/machine/workflow-tree.mjs gateBasesOf, newest first): a gate over another base judges other findings than the op's own.
  if (gateBases.length && !gateBases.includes(gate.base)) {
    const older = gateBases.length > 1 ? ` (or ${gateBases.length - 1} older checkpoint(s) its side has not moved since)` : '';
    return { status: 'red', code: 'op-gate-base-mismatch', detail: `the gate measured against ${String(gate.base ?? 'no base').slice(0, 12)}, not the workflow checkpoint ${gateBases[0].slice(0, 12)}${older}: run starci gate run again without --base in the workflow worktree and attach it`, findings: [] };
  }
  if (gate.exit === GATE_EXIT.toolFailed || (gate.errors ?? []).length) {
    const cause = oneLine((gate.errors ?? []).join('; ') || `exit ${gate.exit}`);
    return { status: 'unavailable', code: 'op-gate-tool-failed', detail: `the gate could not run a tool: ${cause}`, findings: (gate.errors ?? []).map(String) };
  }
  const fresh = Array.isArray(gate.findings) ? gate.findings : [];
  if (gate.exit !== GATE_EXIT.clean || Number(gate.counts?.new ?? fresh.length) > 0) {
    const listed = fresh.slice(0, FINDINGS_LISTED).map((f) => {
      const line = f.line ? `:${f.line}` : '';
      return `${f.path ?? '-'}${line} ${f.engine}/${f.rule} ${oneLine(f.message, 160)}`;
    });
    const first = listed[0] ?? `exit ${gate.exit}`;
    return { status: 'red', code: 'op-gate-new-findings', detail: `${gate.counts?.new ?? fresh.length} new finding(s) over base ${String(gate.base ?? '').slice(0, 12)}; first: ${first}`, findings: listed };
  }
  if (current) {
    const problem = currentGateProblem(gate, snapshot, digest);
    if (problem) return { status: 'unavailable', code: 'op-gate-tool-failed', detail: problem, findings: [] };
  }
  let read;
  try { read = judgeReadDigest(digest, kinds, doc, { root: snapshot?.root, expected: expectedRead }); }
  catch (error) { read = { status: 'no-pattern', detail: `required READ input could not be verified: ${String(error?.message ?? error)}`, uncovered: [] }; }
  if (read.status === 'missing') return { status: 'missing', code: 'op-read-digest-missing', detail: `${read.detail}: the op skipped READ (starci gate read --touch ... --out read-digest.json)`, findings: [] };
  if (read.status === 'no-pattern') return { status: 'red', code: 'op-read-digest-no-pattern', detail: read.detail, findings: read.uncovered.map((u) => `${u.path ?? '-'} ${u.slot ?? 'unknown kind'} owes ${u.owed.join(', ') || 'knowledge/patterns/**'}`) };
  return { status: 'pass', code: null, detail: null, findings: [] };
}

/** Whether an op is held to the loop. */
const enforcesLoop = (op, doc = loadOpGate()) => loopOps(doc).has(op);

/**
 * The judgment of a job's files: {op, judged, gateFile, digestFile} - null when the op is not held to the loop. `roots` are the
 * job's placement roots. A current binding independently resolves every admitted owned delta, including files absent
 * from the submitted list. Missing target/ownership custody refuses. Non-app code keeps its declared checkers.
 */
// Whether the source files of one placement root are app code: the app's slot owner maps them to its
// profiles (declared sides, an app.* slot, or a declared app repository's unslotted file that produced
// output has not claimed). Conditional writers inherit the app loop only for these; drawings,
// runtime/infra scripts and Markdown code fences keep their declared mechanism/checker profiles.
const appCodeOf = async (root, source, ctx) => {
  const sourceKinds = source.length ? await ctx.kindResolver(root, source.map((file) => file.path)) : [];
  let declaredApp = false;
  try { declaredApp = JSON.parse(fs.readFileSync(locateDeclaration(root).file, 'utf8')).kind === APP_SCOPE; } catch { /* no app declaration: use the declared non-app profile */ }
  const producedProfile = proofEntriesOf(ctx.op, { mode: ctx.mode, doc: ctx.doc }).some(({ proof }) => proof === 'produced-lint');
  return sourceKinds.some((kind) => SIDES.includes(String(kind.slot ?? '').split('.')[0])
    || String(kind.slot ?? '').startsWith('app.') || (declaredApp && !kind.slot && !producedProfile));
};

// The judgment executable files of a non-app op still owe: an applicable executable checker proof and
// its READ digest. null means the root judges nothing (the loop's `continue`).
const nonAppLoopJudgment = async (root, { source, digest, snapshot }, ctx) => {
  // Document and code gates share a schema; the declared docs profile cannot measure a new executable source file.
  // The selected op-proof judge still owns its verdict; profile selection grants no fresh-input claim.
  const executable = new Set([LINT_SCHEMA, GATE_SCHEMA, TEST_WORLD_RUN_SCHEMA, UNIT_RUN_SCHEMA, RELEASE_PROOF_SCHEMA]);
  const selected = proofEntriesOf(ctx.op, { mode: ctx.mode, doc: ctx.doc }).filter(({ proof }) => executable.has(ctx.doc.proofs?.[proof]?.schema) && !isDocGate(ctx.doc.proofs?.[proof]));
  if (!selected.length) return { op: ctx.op, judged: { status: 'missing', code: 'op-gate-proof-missing',
    detail: `REF-VERIFY-1: no applicable executable checker proof is declared for ${source.map((file) => file.path).join(', ')}; document checks or a Markdown code fence do not measure these files`, findings: [] }, gateFile: null, digestFile: null };
  const expectedRead = await ctx.readDigest({ root, touch: snapshot.inputs.map((file) => file.path), doc: ctx.doc });
  const read = judgeReadDigest(digest?.doc, expectedRead.slotMap, ctx.doc, { current: true, root, expected: expectedRead });
  if (read.status !== 'pass') return { op: ctx.op, judged: { status: read.status === 'missing' ? 'missing' : 'red',
    code: read.status === 'missing' ? 'op-read-digest-missing' : 'op-read-digest-no-pattern', detail: read.detail, findings: [] }, gateFile: null, digestFile: digest?.file ?? null };
  return null;
};

// One placement root's judgment: {op, judged, gateFile, digestFile}, or null when the root owes none.
const judgeRoot = async (root, ctx) => {
  const { targets, placements, binding, files, gateBases } = ctx;
  const target = targets.find((row) => sameResolvedPath(row.root, root));
  const owned = [...new Set(placements.filter((p) => sameResolvedPath(p.base, root)).map((p) => normRel(p.path)))].sort(byCodeUnit);
  if (!target?.head || JSON.stringify(target.owned) !== JSON.stringify(owned))
    throw new Error('the admitted baseline or owned paths differ from the job placement');
  const gate = readAttached(files, GATE_SCHEMA, (g) => !isDocGate(g) && typeof g.root === 'string' && sameResolvedPath(g.root, root));
  const digest = readAttached(files, DIGEST_SCHEMA, (d) => typeof d.root === 'string' && sameResolvedPath(d.root, root));
  if (gate && (!Number.isFinite(Date.parse(gate.doc.at)) || Date.parse(gate.doc.at) < binding.at || Date.parse(gate.doc.at) > Date.now()))
    throw new Error('CHECK is not from the current admitted attempt');
  if (digest && (!Number.isFinite(Date.parse(digest.doc.at)) || Date.parse(digest.doc.at) < binding.at))
    throw new Error('READ is not from the current admitted attempt');
  const base = gateBases.includes(gate?.doc.base) ? gate.doc.base : target.head;
  const snapshot = gateInputSnapshot(root, base, gate?.doc.changed ?? [], owned);
  const source = snapshot.inputs.filter((file) => /\.(?:[cm]?[jt]sx?)$/i.test(file.path));
  const appCode = await appCodeOf(root, source, ctx);
  if (source.length && !appCode) return nonAppLoopJudgment(root, { source, digest, snapshot }, ctx);
  if (!enforcesLoop(ctx.op, ctx.doc) && !appCode) return null;
  const expectedRead = await ctx.readDigest({ root, touch: snapshot.inputs.map((file) => file.path), doc: ctx.doc });
  const kinds = expectedRead.slotMap.map(({ path: file, slot }) => ({ path: file, slot }));
  const judged = judgeLoop({ gate: gate?.doc ?? null, digest: digest?.doc ?? null, kinds, doc: ctx.doc,
    gateBases, current: true, snapshot, expectedRead });
  return { op: ctx.op, judged, gateFile: gate?.file ?? null, digestFile: digest?.file ?? null };
};

export async function judgeJobLoop({ op, files, roots = [], doc = loadOpGate(), gateBases = [], binding = null, mode = null,
  readDigest = buildReadDigest, kindResolver = kindsOf }) {
  if (!binding || (!Object.hasOwn(binding, 'at') && !Object.hasOwn(binding, 'targets')))
    return { op, judged: { status: 'missing', code: 'op-gate-proof-missing', detail: 'the admission has no recorded target/ownership baseline', findings: [] }, gateFile: null, digestFile: null };
  const unavailable = (detail) => ({ op, judged: { status: 'unavailable', code: 'op-gate-tool-failed', detail, findings: [] }, gateFile: null, digestFile: null });
  const placements = binding.placements ?? [], targets = binding.targets;
  if (!Number.isFinite(binding.at) || !Array.isArray(targets) || !targets.length || !placements.length || placements.some((p) => p.unresolved || !p.base))
    return unavailable('the admitted job has no complete target/ownership baseline');
  const known = [...new Set(placements.map((p) => path.resolve(p.base)))];
  if (targets.length !== known.length || targets.some((row, i) => targets.slice(0, i).some((prior) => sameResolvedPath(prior.root, row.root))))
    return unavailable('the admitted target list does not match the persisted placements');
  const ctx = { op, files, targets, placements, binding, doc, gateBases, mode, readDigest, kindResolver };
  const judgments = [];
  for (const root of known) {
    try {
      const outcome = await judgeRoot(root, ctx);
      if (!outcome) continue;
      if (outcome.judged.status !== 'pass') return outcome;
      judgments.push(outcome);
    } catch (error) { return unavailable(`the current owned slice could not be bound: ${String(error?.message ?? error)}`); }
  }
  return judgments.length ? { op, judged: judgments[0].judged,
    gateFile: judgments.map((j) => j.gateFile).join(' + '), digestFile: judgments.map((j) => j.digestFile).join(' + ') } : null;
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

// The remedy the refusal text ends with, by refusal code.
const loopRefusalNext = (code) => {
  if (code === 'op-gate-tool-failed') return 'A gate tool could not run: fix the environment cause and rerun the gate, or settle blocked; never done without a gate.';
  if (code === 'op-gate-new-findings') return 'Fix the listed findings and rerun the gate, up to params.gateRounds rounds; still red after the last round is blocked with these findings.';
  if (code?.startsWith('op-read-digest')) return 'READ before coding: run starci gate read over the touched files, read what it lists and attach read-digest.json.';
  return 'Run starci gate run over the change and attach its gate.json.';
};

/** What `starci kernel settle` prints when it refuses a done the loop does not allow. */
export function loopRefusalText(op, judged, jobId) {
  return `settle REFUSED for ${jobId} (${op}): ${judged.code} - ${judged.detail}; the job stays reported. ${loopRefusalNext(judged.code)}`;
}
