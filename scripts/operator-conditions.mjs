import { cellAliases, kindOf, isYes } from './operator-md.mjs';

const plain = value => String(value ?? '').replaceAll('`', '').trim();
export function requirementValues(op, requirements = {}) {
  return { ...Object.fromEntries((op.tables.requirements?.rows ?? []).map(row => [plain(row.field), plain(row.default)])), ...requirements };
}
export function requiredWhen(cell, values = {}) {
  if (isYes(cell)) return true;
  const text = plain(cell);
  if (text === 'no' || text === 'không' || text === '—' || text === '') return false;
  const match = /^when ([a-zA-Z][a-zA-Z0-9]*)=([a-zA-Z0-9-]+)$/.exec(text);
  if (!match) throw new Error(`invalid Required condition: ${text}`);
  return values[match[1]] === match[2];
}
export function conditionalRequirementErrors(op, requirements = {}) {
  const values = requirementValues(op, requirements), errors = [];
  for (const row of op.tables.requirements?.rows ?? []) {
    const type = plain(row.type);
    if (type.startsWith('enum:') && !type.slice(5).split(',').map(value => value.trim()).includes(values[plain(row.field)])) errors.push(`requirements.${plain(row.field)} must be one of ${type.slice(5)}`);
  }
  return errors;
}
// The same authored table resolves dependency closure, chain admission and request admission.
export function effectiveOperator(node, requirements = {}) {
  if (!node.pkg?.en) return node;
  const op = node.pkg.en, values = requirementValues(op, requirements);
  const rows = new Map((op.tables.inputs?.rows ?? []).map(row => [kindOf(row.kind), row]));
  const inputs = node.inputs.map(input => ({ ...input, required: requiredWhen(rows.get(input.kind)?.required, values) }));
  const roles = new Set((op.tables.context?.rows ?? []).filter(row => requiredWhen(row.required, values)).flatMap(row => cellAliases(row.alias)).map(alias => /^@workspaces\/(fe|be)\b/.exec(alias)?.[1]).filter(Boolean));
  return { ...node, inputs, required: inputs.filter(input => input.required), optional: inputs.filter(input => !input.required), roles };
}
