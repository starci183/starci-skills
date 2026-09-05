import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateAgainst } from './json-schema.mjs';

export const loadInteractionPolicy = async (root) => JSON.parse(await readFile(path.join(root, 'resources/interaction.json'), 'utf8'));

export function interactionErrors(policy, interaction, choices = {}, status = 'blocked') {
  if (interaction === undefined) return [];
  const errors = [];
  if (status !== 'blocked') errors.push('interaction: an unanswered choice is blocked, never a done result');
  if (!policy.questionKinds.includes(interaction?.kind)) errors.push('interaction: only a tier-choice may ask the user');
  const options = interaction?.options;
  if (!Array.isArray(options) || options.length < policy.minOptions || options.length > policy.maxOptions) errors.push(`interaction: a tier choice has ${policy.minOptions}–${policy.maxOptions} material options`);
  if (Array.isArray(options)) {
    for (const key of ['id', 'label', 'tradeoff']) {
      if (options.some((option) => typeof option?.[key] !== 'string' || !option[key].trim())) errors.push(`interaction: every option needs ${key}`);
      if (new Set(options.map((option) => typeof option?.[key] === 'string' ? option[key].trim() : undefined)).size !== options.length) errors.push(`interaction: options need distinct ${key} values`);
    }
  }
  if (typeof interaction?.decisionId !== 'string' || !interaction.decisionId.trim()) errors.push('interaction: a stable decisionId is required');
  if (Object.hasOwn(choices ?? {}, interaction?.decisionId ?? '')) errors.push('interaction: this decision already has a user choice; reuse it without asking again');
  return errors;
}

export function selectionErrors(policy, request, choices = {}) {
  if (request.decisionId === undefined && request.selectedOption === undefined) return [];
  const choice = Object.hasOwn(choices ?? {}, request.decisionId ?? '') ? choices[request.decisionId] : null;
  if (!request.decisionId || !request.selectedOption || !choice) return ['request: a selected tier needs the actual user choice in state.json.choices'];
  const errors = [];
  if (choice.selectedBy !== policy.selectionSource || typeof choice.sourceRef !== 'string' || !choice.sourceRef.trim()) errors.push('request: a tier is selected by the user with a sourceRef to their message, never defaulted by an agent');
  if (choice.selected !== request.selectedOption) errors.push('request: selectedOption differs from the recorded user choice');
  return errors;
}

// The two lines the orchestrator prints to the root chat after a transition. Their shape is read from
// interaction.json#transitionLog.shape and compiled here, so the gate carries no copy of it: `N/M` is
// a branch cell, `operator` an operator id, `k/n` a count, `<done | blocked STOP>` the outcome, and any
// other `<…>` placeholder one non-empty run of text. Both lines name the same branch.
export function compileLogShape(template) {
  const escaped = String(template).replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const pattern = escaped
    .replace('<done \\| mismatch \\| blocked STOP>', '(?:done|mismatch|blocked [A-Z][A-Z0-9_]+)')
    .replace(/<done \\\| blocked STOP>/g, '(?:done|blocked [A-Z][A-Z0-9_]+)')
    .replace(/<k>\/<n>/g, '\\d+/\\d+')
    .replace(/<[^<>]+>/g, '.+')
    .replace(/\\\[N\/M operator\\\]/g, '\\[(\\d+/\\d+) [a-z]+(?:\\.[a-z]+)+\\]');
  return new RegExp(`^${pattern}$`);
}
export function transitionLogErrors(policy, lines) {
  const errors = [];
  const log = policy.transitionLog ?? {};
  const want = log.linesPerBranch;
  if (!Array.isArray(lines) || lines.length !== want) { errors.push(`transition log: exactly ${want} lines are printed per transition (interaction.json#transitionLog), got ${Array.isArray(lines) ? lines.length : 'none'}`); return errors; }
  const cells = [];
  lines.forEach((line, i) => {
    const text = String(line);
    if (/[\r\n]/.test(text)) errors.push(`transition log line ${i + 1}: spans more than one line`);
    const m = compileLogShape(log.shape[i]).exec(text);
    if (!m) errors.push(`transition log line ${i + 1}: does not follow "${log.shape[i]}"`);
    cells.push(m?.[1] ?? null);
  });
  if (cells.every(Boolean) && new Set(cells).size !== 1) errors.push(`transition log: both lines name one branch, got ${cells.join(' and ')}`);
  return errors;
}

// A legacy user route names an owner; it is not itself a question or an operation grant.
export function interactionDisposition(route, interaction) {
  if (interaction) return 'tier-choice';
  if (route?.kind === 'user') return 'owner-handoff';
  if (route?.kind === 'external') return 'blocked-report';
  return 'continue';
}

export async function branchInteraction(root, dir) {
  const response = JSON.parse(await readFile(path.join(dir, 'response/response.json'), 'utf8'));
  // Find the session for both ordinary and nested-exchange branches.
  let parent = path.resolve(dir);
  while (!/^step-\d+$/.test(path.basename(parent)) && path.dirname(parent) !== parent) parent = path.dirname(parent);
  const stateFile = path.join(path.dirname(parent), 'state.json');
  const state = existsSync(stateFile) ? JSON.parse(await readFile(stateFile, 'utf8')) : {};
  const schema = JSON.parse(await readFile(path.join(root, 'templates/step/response.schema.json'), 'utf8'));
  const errors = response.interaction === undefined ? [] : validateAgainst(schema.properties.interaction, response.interaction, 'interaction');
  return [...errors, ...interactionErrors(await loadInteractionPolicy(root), response.interaction, state.choices, response.status ?? null)];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  if (!process.argv[2]) { process.stderr.write('usage: node scripts/validate-interaction.mjs <branch>\n'); process.exitCode = 2; }
  else {
    const errors = await branchInteraction(root, path.resolve(process.argv[2]));
    if (errors.length) { process.stderr.write(errors.join('\n') + '\n'); process.exitCode = 1; }
    else process.stdout.write('interaction valid\n');
  }
}
