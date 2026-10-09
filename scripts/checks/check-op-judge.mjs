#!/usr/bin/env node
// check-op-judge.mjs — RT_OP_JUDGE_UNDECLARED (part of `npm run check`).
//   runs in the check stage (self-check op-judge); --json prints the findings as JSON
//
// Principle P2 (modules/kernel/roles.yaml): the maker never judges its own work. Every op contract (modules/ops/ops/<op>.yaml) declares
// who judges its product in the required field `judge`, a list of at least one entry (machine, critic, owner, next-leg), each with a
// one-line why. The vocabulary and the tables the entries are held to are modules/kernel/op-judges.yaml. This check refuses:
//   - an op with no `judge`, an empty list, an unknown kind, an entry without its parts or without a why;
//   - a machine entry that names a measure the registry does not know (a measure the runtime does not own or re-run is no judge: a
//     test file the same attempt wrote cannot be named), that cites a proof the contract does not have, that leaves out a measure the
//     runtime applies to the op (op-gate, sonar-gate, an op-proof, proof-media, ...) or names one it does not, or that rests on a
//     process measure alone;
//   - a critic entry for an op the Critic table (modules/kernel/critic.yaml coverage) does not mark covered, or the reverse, or a rubric
//     that does not resolve;
//   - an owner entry for an op with no owner gate in the registry (or a gate whose file or anchor is gone), or the reverse;
//   - a next-leg entry whose leg is not a registered reviewer of the op (or a reviewer whose contract no longer says it reviews), or the reverse.
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { isMain } from '../lib/is-main.mjs';
import { byCodeUnit } from '../lib/list.mjs';
import { printFindings } from '../lib/check-scan.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { JUDGES_FILE, OPS_DIR, judgeRegistry } from '../kernel/op-judge.mjs';
import { externalOpsOf } from '../kernel/leg-status-view.mjs';
import { KERNEL_ONLY_OPS } from '../machine/reported-jobs.mjs';

export const CODE = 'RT_OP_JUDGE_UNDECLARED';
const KINDS = ['machine', 'critic', 'owner', 'next-leg'];
const INDEPENDENCE = ['runtime', 'repository', 'earlier-leg'];
const PROOF_FAMILY = 'op-proof:';
const CRITIC_FILE = 'modules/kernel/critic.yaml';
const RUBRICS_FILE = 'modules/kernel/critic-rubrics.yaml';
const OP_GATE_FILE = 'knowledge/op-gate.yaml';
const GATE_SETTLE = 'scripts/kernel/gate-settle.mjs';

const readYaml = (root, rel) => parseYaml(fs.readFileSync(path.join(root, rel), 'utf8'));
const exists = (root, rel) => fs.existsSync(path.join(root, rel));
const opPath = (op) => `${OPS_DIR}/${op}.yaml`;
const at = (file) => (message) => ({ code: CODE, path: file, message });
const textOf = (value) => (typeof value === 'string' ? value : (value?.en ?? ''));
const flat = (value) => String(value ?? '').replace(/\s+/g, ' ');

/** The list a `file#dotted.path` reference names. */
function tableOf(root, ref) {
  const [file, keyPath] = String(ref).split('#');
  return keyPath.split('.').reduce((node, key) => node?.[key], readYaml(root, file)) ?? [];
}

const proofNames = (entries) => (entries ?? []).map((entry) => (typeof entry === 'string' ? entry : entry.proof));

/** Everything the declarations are read against, loaded once. */
export function loadFacts(root = skillRoot) {
  const opsDir = path.join(root, OPS_DIR);
  const ids = fs.readdirSync(opsDir).filter((name) => name.endsWith('.yaml')).map((name) => name.slice(0, -5)).sort(byCodeUnit);
  const opGate = readYaml(root, OP_GATE_FILE);
  return {
    root, ids, registry: judgeRegistry(root), opGate,
    contracts: Object.fromEntries(ids.map((id) => [id, readYaml(root, opPath(id))])),
    critic: readYaml(root, CRITIC_FILE), rubrics: readYaml(root, RUBRICS_FILE),
    undispatched: new Set([...externalOpsOf(root), ...KERNEL_ONLY_OPS]),
  };
}

/** Whether a measure applies to an op: true, false, or null when the measure is free (declared when the contract cites it). */
function appliesTo(measure, op, facts) {
  const rule = measure.applies;
  if (rule === 'dispatched') return !facts.undispatched.has(op);
  if (rule === 'free' || rule === 'opProofs') return null;
  if (rule.table) return tableOf(facts.root, rule.table).includes(op);
  if (rule.policy) return Boolean(facts.contracts[op].policy?.[rule.policy]);
  if (rule.ops) return rule.ops.includes(op);
  if (rule.writes) return (facts.contracts[op].writes ?? []).some((write) => rule.writes.some((name) => String(write.path).includes(name)));
  return false;
}

/** The measure ids the runtime applies to an op, and the ids that are free to cite. */
function expectedMeasures(op, facts) {
  const expected = new Set();
  const free = new Set();
  for (const [id, measure] of Object.entries(facts.registry.measures)) {
    if (measure.applies === 'opProofs') continue;
    const applies = appliesTo(measure, op, facts);
    if (applies === null) free.add(id);
    else if (applies) expected.add(id);
  }
  for (const proof of proofNames(facts.opGate.opProofs?.[op])) expected.add(PROOF_FAMILY + proof);
  return { expected, free };
}

const isProcess = (id, registry) => id.startsWith(PROOF_FAMILY) && (registry.measures['op-proof'].processProofs ?? []).includes(id.slice(PROOF_FAMILY.length));

/** Whether a known measure judges the product now: not a process measure and not one still in report mode. */
const judgesNow = (id, registry) => !isProcess(id, registry) && registry.measures[id.startsWith(PROOF_FAMILY) ? 'op-proof' : id].mode !== 'report';

function measureKnown(id, registry) {
  const family = id.startsWith(PROOF_FAMILY) ? 'op-proof' : id;
  return Boolean(registry.measures[family]) && (family !== 'op-proof' || id.length > PROOF_FAMILY.length);
}

/** A cited proof that does not exist in the contract, for any entry kind. */
function citedProofFindings(op, entry, contract) {
  const have = new Set((contract.proofs ?? []).map((proof) => proof.id));
  return (entry.proofs ?? []).filter((id) => !have.has(id)).map((id) => at(opPath(op))(`judge ${entry.by} cites the proof ${id}, which the contract does not have`));
}

/** The shape of one entry. */
function entryShape(op, entry) {
  const out = at(opPath(op));
  const need = { machine: ['measures'], critic: ['rubric', 'runs'], owner: [], 'next-leg': ['leg'] }[entry?.by];
  if (!need) return [out(`judge has an entry of unknown kind ${JSON.stringify(entry?.by)} (one of ${KINDS.join(', ')})`)];
  const findings = need.filter((key) => !entry[key]).map((key) => out(`judge ${entry.by} entry has no ${key}`));
  if (!String(entry.why ?? '').trim()) findings.push(out(`judge ${entry.by} entry has no why`));
  return findings;
}

function machineFindings(op, entries, facts) {
  const out = at(opPath(op));
  const declared = new Set(entries.filter((entry) => entry.by === 'machine').flatMap((entry) => entry.measures ?? []));
  const { expected, free } = expectedMeasures(op, facts);
  const findings = [];
  for (const id of declared) {
    if (!measureKnown(id, facts.registry)) findings.push(out(`judge machine names ${id}, which ${JUDGES_FILE} does not list: only a measure the runtime owns and re-runs at settle is a machine judge`));
    else if (!expected.has(id) && !free.has(id)) findings.push(out(`judge machine names ${id}, which the runtime does not apply to ${op}`));
  }
  for (const id of expected) if (!declared.has(id)) findings.push(out(`judge machine leaves out ${id}, which the runtime applies to ${op}`));
  if (declared.size && ![...declared].some((id) => measureKnown(id, facts.registry) && judgesNow(id, facts.registry))) findings.push(out('judge machine rests on process or report-mode measures alone: it needs a measure that judges the product'));
  return [...findings, ...scriptFindings(op, entries, facts)];
}

/** contract-script is declared only with a cited proof whose `check:` is a script outside the gate settle. */
function scriptFindings(op, entries, facts) {
  const cited = entries.filter((entry) => entry.by === 'machine' && (entry.measures ?? []).includes('contract-script'));
  if (!cited.length) return [];
  const proofs = new Map((facts.contracts[op].proofs ?? []).map((proof) => [proof.id, proof]));
  const ok = cited.some((entry) => (entry.proofs ?? []).some((id) => proofs.get(id)?.check && proofs.get(id).check !== GATE_SETTLE));
  return ok ? [] : [at(opPath(op))('judge machine names contract-script but cites no proof whose check: is a script of its own')];
}

function criticFindings(op, entries, facts) {
  const out = at(opPath(op));
  const covered = (facts.critic.coverage ?? []).find((row) => row.kind === op);
  const declared = entries.filter((entry) => entry.by === 'critic');
  if (!covered) return declared.length ? [out(`judge critic is declared but ${CRITIC_FILE} coverage has no row for ${op}`)] : [];
  if (covered.status !== 'covered') return declared.length ? [out(`judge critic is declared but the coverage row of ${op} is ${covered.status}, not covered`)] : [];
  if (!declared.length) return [out(`${CRITIC_FILE} coverage marks ${op} covered but the contract declares no critic judge`)];
  return declared.flatMap((entry) => rubricFindings(op, entry, covered, facts));
}

function rubricFindings(op, entry, covered, facts) {
  const out = at(opPath(op));
  const runtime = Boolean(covered.rubric?.ref);
  const findings = [];
  if ((entry.runs === 'runtime') !== runtime) findings.push(out(`judge critic runs ${entry.runs}, but the coverage row of ${op} says the Critic is ${runtime ? 'run by the runtime at settle' : 'run inside the op'}`));
  if (runtime) {
    const kind = (facts.rubrics.kinds ?? []).find((row) => row.id === op);
    if (!kind) findings.push(out(`judge critic: ${RUBRICS_FILE} has no rubric for ${op}`));
    if (entry.rubric !== `${RUBRICS_FILE}#kinds[id=${op}]`) findings.push(out(`judge critic rubric must be ${RUBRICS_FILE}#kinds[id=${op}]`));
  } else if (!exists(facts.root, entry.rubric) || !flat(covered.rubric).includes(entry.rubric)) {
    findings.push(out(`judge critic rubric ${entry.rubric} is not a file the coverage row of ${op} names`));
  }
  return findings;
}

function ownerFindings(op, entries, facts) {
  const out = at(opPath(op));
  const gate = facts.registry.ownerGates?.[op];
  const declared = entries.some((entry) => entry.by === 'owner');
  if (declared && !gate) return [out(`judge owner is declared but ${JUDGES_FILE} ownerGates has no gate for ${op}: an owner judges only where an owner gate exists`)];
  if (!declared && gate) return [out(`${JUDGES_FILE} ownerGates names a gate for ${op} but the contract declares no owner judge`)];
  return [];
}

function nextLegFindings(op, entries, facts) {
  const out = at(opPath(op));
  const reviewers = facts.registry.reviewers ?? {};
  const declared = new Set(entries.filter((entry) => entry.by === 'next-leg').map((entry) => entry.leg));
  const findings = [...declared].filter((leg) => !reviewers[leg]?.reviews?.includes(op) || leg === op)
    .map((leg) => out(`judge next-leg ${leg} is not a registered reviewer of ${op} in ${JUDGES_FILE}`));
  for (const [leg, row] of Object.entries(reviewers)) {
    if (row.reviews.includes(op) && !declared.has(leg)) findings.push(out(`${JUDGES_FILE} registers ${leg} as a reviewer of ${op} but the contract declares no next-leg ${leg}`));
  }
  return findings;
}

/** The findings of one op's declaration. */
function opFindings(op, facts) {
  const contract = facts.contracts[op];
  const entries = contract.judge;
  const out = at(opPath(op));
  if (!Array.isArray(entries)) return [out('has no judge: every op declares who judges its product, and nobody cannot be declared')];
  if (!entries.length) return [out('judge is empty: at least one judge must be declared')];
  const shape = entries.flatMap((entry) => entryShape(op, entry));
  if (shape.length) return shape;
  return [...entries.flatMap((entry) => citedProofFindings(op, entry, contract)), ...machineFindings(op, entries, facts),
    ...criticFindings(op, entries, facts), ...ownerFindings(op, entries, facts), ...nextLegFindings(op, entries, facts)];
}

function measureRegistryFindings(facts) {
  const out = at(JUDGES_FILE);
  return Object.entries(facts.registry.measures).flatMap(([id, measure]) => {
    const findings = [];
    if (!exists(facts.root, measure.source)) findings.push(out(`measure ${id} names the source ${measure.source}, which does not exist`));
    if (!INDEPENDENCE.includes(measure.independence)) findings.push(out(`measure ${id} has the independence ${measure.independence}: only ${INDEPENDENCE.join(', ')} can judge (a measure the maker authors is not a judge)`));
    if (measure.mode !== undefined && measure.mode !== 'report') findings.push(out(`measure ${id} has the mode ${measure.mode}: only report is built, enforcement is added with its own refusal`));
    if (!['product', 'process'].includes(measure.kind)) findings.push(out(`measure ${id} has the unknown kind ${measure.kind}`));
    if (measure.applies?.table && !tableOf(facts.root, measure.applies.table).length) findings.push(out(`measure ${id} reads the table ${measure.applies.table}, which is empty or missing`));
    return findings;
  });
}

function gateRegistryFindings(facts) {
  const out = at(JUDGES_FILE);
  const findings = [];
  for (const [op, gate] of Object.entries(facts.registry.ownerGates ?? {})) {
    const file = path.join(facts.root, gate.at);
    if (!fs.existsSync(file) || !fs.readFileSync(file, 'utf8').includes(gate.anchor)) findings.push(out(`ownerGates ${op}: ${gate.at} no longer holds ${JSON.stringify(gate.anchor)}`));
  }
  for (const [leg, row] of Object.entries(facts.registry.reviewers ?? {})) {
    const goal = textOf(facts.contracts[leg]?.goal);
    if (!flat(goal).includes(row.anchor)) findings.push(out(`reviewers ${leg}: the goal of its contract no longer says ${JSON.stringify(row.anchor)}`));
    for (const op of row.reviews) if (!facts.contracts[op]) findings.push(out(`reviewers ${leg} reviews ${op}, which is no op`));
  }
  const proofs = Object.keys(facts.opGate.proofs ?? {});
  for (const name of Object.values(facts.opGate.opProofs ?? {}).flatMap(proofNames)) if (!proofs.includes(name)) findings.push(out(`op-gate.yaml opProofs names the proof ${name}, which op-gate.yaml proofs does not define`));
  return findings;
}

/** The findings of a loaded set of facts. Pure. */
export function opJudgeFindings(facts) {
  return [...facts.ids.flatMap((op) => opFindings(op, facts)), ...measureRegistryFindings(facts), ...gateRegistryFindings(facts)];
}

/** Run the check on the runtime at `root`. */
export const checkOpJudge = (root = skillRoot) => opJudgeFindings(loadFacts(root));

if (isMain(import.meta.url)) process.exit(printFindings(checkOpJudge(), 'OK: every op declares who judges its product, and the declarations match the runtime tables.'));
