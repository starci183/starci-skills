import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const schemas = {
  input: JSON.parse(readFileSync(new URL('./input.schema.json', import.meta.url), 'utf8')),
  output: JSON.parse(readFileSync(new URL('./output.schema.json', import.meta.url), 'utf8'))
};
let schema = schemas.output;
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function deref(ref) { if (!ref.startsWith('#/')) throw new Error(`unsupported schema ref: ${ref}`); return ref.slice(2).split('/').reduce((v, k) => v[k.replaceAll('~1', '/').replaceAll('~0', '~')], schema); }
function inspect(value, rule, at, errors) {
  if (rule.$ref) inspect(value, deref(rule.$ref), at, errors);
  if (rule.allOf) rule.allOf.forEach((part) => inspect(value, part, at, errors));
  if (rule.oneOf) { const tries = rule.oneOf.map((part) => { const e = []; inspect(value, part, at, e); return e; }); const count = tries.filter((e) => !e.length).length; if (count !== 1) { errors.push(`${at}: expected exactly one schema branch, matched ${count}`); if (count === 0) errors.push(...tries.reduce((best, found) => found.length < best.length ? found : best)); } return; }
  if ('const' in rule && !same(value, rule.const)) errors.push(`${at}: must equal ${JSON.stringify(rule.const)}`);
  if (rule.enum && !rule.enum.some((item) => same(value, item))) errors.push(`${at}: must be one of ${rule.enum.map(JSON.stringify).join(', ')}`);
  const types = Array.isArray(rule.type) ? rule.type : rule.type ? [rule.type] : [];
  if (types.length) { const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : Number.isInteger(value) ? 'integer' : typeof value; if (!types.some((type) => type === actual || (type === 'number' && typeof value === 'number'))) { errors.push(`${at}: expected ${types.join('|')}, got ${actual}`); return; } }
  if (typeof value === 'string') { if (rule.minLength !== undefined && value.length < rule.minLength) errors.push(`${at}: too short`); if (rule.pattern && !new RegExp(rule.pattern).test(value)) errors.push(`${at}: does not match ${rule.pattern}`); }
  if (typeof value === 'number') { if (rule.minimum !== undefined && value < rule.minimum) errors.push(`${at}: must be >= ${rule.minimum}`); if (rule.maximum !== undefined && value > rule.maximum) errors.push(`${at}: must be <= ${rule.maximum}`); }
  if (Array.isArray(value)) { if (rule.minItems !== undefined && value.length < rule.minItems) errors.push(`${at}: needs at least ${rule.minItems} item(s)`); if (rule.maxItems !== undefined && value.length > rule.maxItems) errors.push(`${at}: allows at most ${rule.maxItems} item(s)`); if (rule.uniqueItems && new Set(value.map(JSON.stringify)).size !== value.length) errors.push(`${at}: items must be unique`); if (rule.items) value.forEach((item, i) => inspect(item, rule.items, `${at}[${i}]`, errors)); if (rule.contains && !value.some((item, i) => { const e = []; inspect(item, rule.contains, `${at}[${i}]`, e); return !e.length; })) errors.push(`${at}: missing required item`); }
  if (value && typeof value === 'object' && !Array.isArray(value)) { for (const key of rule.required ?? []) if (!(key in value)) errors.push(`${at}.${key}: required`); const props = rule.properties ?? {}; if (rule.additionalProperties === false) for (const key of Object.keys(value)) if (!(key in props)) errors.push(`${at}.${key}: unknown field`); for (const [key, child] of Object.entries(props)) if (key in value) inspect(value[key], child, `${at}.${key}`, errors); }
}
export function validateAgainst(value, definition) { const errors = []; schema = schemas[definition]; if (!schema) return { ok: false, errors: [`$: missing schema direction ${definition}`] }; inspect(value, schema, '$', errors); return { ok: !errors.length, errors }; }
function isSubset(values, allowed) { const set = new Set(allowed); return values.every((value) => set.has(value)); }
function checkEffective(contract, at, errors) { if (!isSubset(contract.sourceDelta.boundSlots, contract.slots)) errors.push(`${at}.sourceDelta.boundSlots: contains a slot absent from the effective contract`); if (!isSubset(contract.sourceDelta.boundStateInputs, contract.stateInputs)) errors.push(`${at}.sourceDelta.boundStateInputs: contains a state input absent from the effective contract`); if (!isSubset(contract.sourceDelta.resolvedVariableAxes, contract.variableAxes)) errors.push(`${at}.sourceDelta.resolvedVariableAxes: contains a closed axis`); for (const required of ['anatomy', 'closed-invariant', 'owner-substitution']) if (!contract.extensionPolicy.forbidden.includes(required)) errors.push(`${at}.extensionPolicy.forbidden: must include ${required}`); }

export function validateOutput(value) {
  const result = validateAgainst(value, 'output');
  if (!result.ok) return result;
  const errors = [];
  const ownerRefs = value.decisions.map((decision) => decision.ownerRef);
  if (new Set(ownerRefs).size !== ownerRefs.length) errors.push('$.decisions: every owner must receive exactly one verdict');
  const counts = { reuse: 0, extend: 0, 'create-block-or-above': 0, 'grammar-gap': 0 };
  for (const [index, decision] of value.decisions.entries()) {
    counts[decision.verdict] += 1;
    if (decision.effectiveContract) checkEffective(decision.effectiveContract, `$.decisions[${index}].effectiveContract`, errors);
    if (decision.verdict === 'extend') {
      if (!isSubset(decision.axes, decision.effectiveContract.variableAxes)) errors.push(`$.decisions[${index}].axes: contains a closed effective-contract axis`);
      if (!isSubset(decision.axes, decision.declaredDelta.resolvedVariableAxes)) errors.push(`$.decisions[${index}].declaredDelta: must resolve every extended axis`);
    }
  }
  const expected = { reuse: counts.reuse, extend: counts.extend, createBlockOrAbove: counts['create-block-or-above'], grammarGap: counts['grammar-gap'] };
  for (const [key, count] of Object.entries(expected)) if (value.summary[key] !== count) errors.push(`$.summary.${key}: expected ${count}`);
  const hasCreate = counts['create-block-or-above'] > 0;
  const hasGap = counts['grammar-gap'] > 0;
  if (value.summary.hasCreate !== hasCreate) errors.push('$.summary.hasCreate: does not match decisions');
  if (value.summary.hasGrammarGap !== hasGap) errors.push('$.summary.hasGrammarGap: does not match decisions');
  if (value.factsAdd.includes('create-required') !== hasCreate) errors.push('$.factsAdd: create-required must exactly match create verdicts');
  if (value.factsAdd.includes('grammar-gap') !== hasGap) errors.push('$.factsAdd: grammar-gap must exactly match gap verdicts');
  const obligations = new Set(value.requestObligations.map((item) => `${item.kind}:${item.ownerRef}:${item.requestId}`));
  for (const decision of value.decisions.filter((item) => item.verdict === 'create-block-or-above' || item.verdict === 'grammar-gap')) if (!obligations.has(`${decision.verdict}:${decision.ownerRef}:${decision.requestId}`)) errors.push(`$.requestObligations: missing obligation for ${decision.ownerRef}`);
  return { ok: !errors.length, errors };
}
export function runCli(validator, label) { const file = process.argv[2]; if (!file || process.argv.length !== 3) { console.error(`usage: node ${label} <artifact.json>`); process.exitCode = 2; return; } let value; try { value = JSON.parse(readFileSync(resolve(file), 'utf8')); } catch (error) { console.error(`${label}: cannot read valid JSON from ${file}: ${error.message}`); process.exitCode = 1; return; } const result = validator(value); if (!result.ok) { result.errors.forEach((error) => console.error(`${label}: ${error}`)); process.exitCode = 1; return; } console.log(`${label}: valid`); }
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) runCli(validateOutput, 'source-fit output');
