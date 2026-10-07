// op-incident-policy.mjs — reads the one table of what happens when an op cannot proceed (modules/kernel/op-incident-policy.yaml).
// A bound is a number in the table or a ref to the yaml key that owns it; the step line tells the Kernel which row a job is on.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const POLICY_FILE = path.join(skillRoot, 'modules', 'kernel', 'op-incident-policy.yaml');
/** The codes the policy records at its steps; the table's `codes` block declares the same three (the policy spec compares them). */
export const INCIDENT_CODES = Object.freeze({
  agentSwitch: { code: 'op-incident-agent-switch' },
  escalateSupervisor: { code: 'op-incident-escalate-supervisor' },
  escalateOwner: { code: 'op-incident-escalate-owner' },
});
const SELECTOR = /^([^[]+)\[id=([^\]]+)\]$/;

const readYaml = (file) => parseYaml(fs.readFileSync(path.join(skillRoot, file), 'utf8'));

/** The policy document. */
export const incidentPolicy = () => readYaml(path.relative(skillRoot, POLICY_FILE));

const stepOf = (node, token) => {
  const selected = SELECTOR.exec(token);
  if (!selected) return node?.[token];
  return node?.[selected[1]]?.find((entry) => entry?.id === selected[2]);
};

/** The value a `<file>#<dotted.path>` ref names, or undefined. */
export function refValue(ref) {
  const [file, dotted = ''] = String(ref).split('#');
  let node = readYaml(file);
  for (const token of dotted.split('.').filter(Boolean)) node = stepOf(node, token);
  return node;
}

/** The number of one bound: its own value or the value its ref names; null when neither is a finite number. */
export function boundValue(bound) {
  const value = bound?.ref === undefined ? bound?.value : refValue(bound.ref);
  return Number.isFinite(value) ? value : null;
}

/** One row of the table by id, or null. */
const policyRow = (id) => incidentPolicy().rows.find((row) => row.id === id) ?? null;

/** The status projection values of a held queued job, in the table's order (scripts/kernel/cli.mjs QUEUED_BECAUSE). */
export const queuedBecauseKinds = () => incidentPolicy().holds.filter((hold) => hold.queuedBecause).map((hold) => hold.queuedBecause);

/** The switch-agent numbers: {excludeAfter, switchSteps}. */
export const agentSwitchOf = () => incidentPolicy().agentSwitch;

/** The code recorded when the row's bound is spent and its work goes to the next handler. */
const escalationCodeOf = (row, codes) => (row.next === 'owner' ? codes.escalateOwner.code : codes.escalateSupervisor.code);

/**
 * The step line the Kernel reads for a job on row `rowId`: which attempt of how many, what runs next and who is next after.
 * `detail` names what the count is about (a pool and its cause).
 */
export function policyStepOf(rowId, { attempt, of, detail }) {
  const row = policyRow(rowId);
  if (!row) throw new Error(`no op-incident policy row ${rowId}`);
  const escalateCode = escalationCodeOf(row, incidentPolicy().codes);
  return { row: row.id, handler: row.handler, attempt, of, next: row.next, code: row.code, escalateCode,
    line: `${row.id}: attempt ${attempt} of ${of} (${detail}); ${row.handler}: ${row.action}; when spent: escalate to ${row.next} (${escalateCode})` };
}

/** Whether a worker question is the owner's by the table's ownerOnlyQuestions classes. */
export const ownerOnlyQuestion = (text) => incidentPolicy().ownerOnlyQuestions.some((source) => new RegExp(source, 'i').test(String(text ?? '')));

/** The Kernel seat's wake counters: {failReplace, failWindowMs, idleReplace, idleReplacedWindowMs}. */
export const seatWakeOf = () => incidentPolicy().seatWake;
