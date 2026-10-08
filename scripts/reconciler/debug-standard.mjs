// debug-standard.mjs — judges the snapshot against the operating standard (modules/reconciler/operating-standard.yaml): every
// host step once, every running workflow step by step, and for each workflow the step it stands at (`standardStep`) and the first
// step whose bound is spent (`firstDeparture`). Pure over a collected snapshot; the yaml is read once through `loadStandard`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { refValue } from '../kernel/op-incident-policy.mjs';
import { PROBES } from './debug-standard-probes.mjs';

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'modules', 'reconciler', 'operating-standard.yaml');
const RANK = Object.freeze({ overdue: 3, waiting: 2, done: 1, na: 0 });

/** The value a ref names, following a ref that names another ref. */
const resolved = (node) => (node && typeof node === 'object' && node.ref !== undefined ? resolved(refValue(node.ref)) : node);

const numberOf = (bound, where) => {
  if (bound === null || bound === undefined) return null;
  const value = resolved(bound);
  if (!Number.isFinite(value)) throw new Error(`operating-standard.yaml ${where} does not name a number`);
  return value;
};

/** The standard with every bound resolved to milliseconds (null for a step that waits on a party with no bound). */
export function loadStandard(file = FILE) {
  const doc = parseYaml(fs.readFileSync(file, 'utf8'));
  const steps = doc.steps.map((s) => ({ ...s, bound: numberOf(s.bound, `${s.id}.bound`), boundKernel: numberOf(s.boundKernel, `${s.id}.boundKernel`) }));
  for (const s of steps) if (!PROBES[s.probe]) throw new Error(`operating-standard.yaml ${s.id} names the probe ${s.probe}, which does not exist`);
  return { steps, departures: doc.departures, happy: doc.happy };
}

/** The worst state of a list of attempt answers: overdue over waiting over done over na. */
function worst(items) {
  return items.reduce((top, item) => (RANK[item.state] > RANK[top] ? item.state : top), 'na');
}

/** One step's answer: its probe's single answer, or the worst of the per-attempt answers with the items kept. */
function answerStep(step, ctx) {
  const probeCtx = { ...ctx, bound: step.bound, boundKernel: step.boundKernel, boundChecks: ctx.boundOf('checks-rerun') };
  const answer = PROBES[step.probe](probeCtx);
  if (!Array.isArray(answer)) return { id: step.id, actor: step.actor, scope: step.scope, ...answer };
  const state = worst(answer);
  const first = answer.find((item) => item.state === state);
  return { id: step.id, actor: step.actor, scope: step.scope, state, evidence: first?.evidence ?? 'no attempt reached this step', departure: first?.departure ?? null, items: answer };
}

const standing = (steps) => {
  const open = steps.find((s) => s.state === 'waiting' || s.state === 'overdue');
  return open ? open.id : steps.filter((s) => s.state === 'done').pop()?.id ?? null;
};

/** The host steps (scope host) over the whole snapshot. */
function hostSteps(standard, base) {
  return standard.steps.filter((s) => s.scope === 'host').map((s) => answerStep(s, base));
}

/** One workflow, step by step: its own steps and its attempts' steps, in the order of the standard. */
function workflowSteps(standard, base, view) {
  const ctx = { ...base, workflow: view.source, kernel: view.kernel, running: view.running };
  const steps = standard.steps.filter((s) => s.scope !== 'host').map((s) => answerStep(s, ctx));
  return { id: view.id, name: view.name, steps, standardStep: standing(steps), firstDeparture: steps.find((s) => s.state === 'overdue') ?? null };
}

/**
 * The standard judged over one snapshot. `base` carries what the probes read besides a workflow: {now, n, reconciler, supervisor,
 * admission}; `views` pairs each snapshot workflow with its analysed Kernel section and running list.
 */
export function judgeStandard(standard, base, views) {
  const boundOf = (id) => standard.steps.find((s) => s.id === id)?.bound ?? 0;
  const withBounds = { ...base, boundOf };
  return { host: hostSteps(standard, withBounds), workflows: views.map((view) => workflowSteps(standard, withBounds, view)) };
}
