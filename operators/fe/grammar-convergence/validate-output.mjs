import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const schemas = {
  input: JSON.parse(readFileSync(new URL('./input.schema.json', import.meta.url), 'utf8')),
  output: JSON.parse(readFileSync(new URL('./output.schema.json', import.meta.url), 'utf8'))
};
let schema = schemas.output;
const forbidden = /(?:^|[-_./])(customer|user|student|course|vps|server|price|payment|order|subscription|entitlement|business|refund|purchase)(?:$|[-_./])/i;
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
  if (Array.isArray(value)) { if (rule.minItems !== undefined && value.length < rule.minItems) errors.push(`${at}: needs at least ${rule.minItems} item(s)`); if (rule.maxItems !== undefined && value.length > rule.maxItems) errors.push(`${at}: allows at most ${rule.maxItems} item(s)`); if (rule.uniqueItems && new Set(value.map(JSON.stringify)).size !== value.length) errors.push(`${at}: items must be unique`); if (rule.items) value.forEach((item, i) => inspect(item, rule.items, `${at}[${i}]`, errors)); if (rule.contains && !value.some((item, i) => { const e = []; inspect(item, rule.contains, `${at}[${i}]`, e); return !e.length; })) errors.push(`${at}: missing required item`); }
  if (value && typeof value === 'object' && !Array.isArray(value)) { for (const key of rule.required ?? []) if (!(key in value)) errors.push(`${at}.${key}: required`); const props = rule.properties ?? {}; if (rule.additionalProperties === false) for (const key of Object.keys(value)) if (!(key in props)) errors.push(`${at}.${key}: unknown field`); for (const [key, child] of Object.entries(props)) if (key in value) inspect(value[key], child, `${at}.${key}`, errors); }
}
export function validateAgainst(value, definition) { const errors = []; schema = schemas[definition]; if (!schema) return { ok: false, errors: [`$: missing schema direction ${definition}`] }; inspect(value, schema, '$', errors); return { ok: !errors.length, errors }; }
function scanNeutral(value, at, errors) { if (typeof value === 'string' && forbidden.test(value)) errors.push(`${at}: business-bearing token is forbidden in Grammar`); else if (Array.isArray(value)) value.forEach((item, i) => scanNeutral(item, `${at}[${i}]`, errors)); else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) scanNeutral(item, `${at}.${key}`, errors); }

export function validateOutput(value) {
  const result = validateAgainst(value, 'output');
  if (!result.ok) return result;
  const errors = [];
  if (value.status === 'ready') {
    if (!value.selections.length && !value.gaps.length) errors.push('$: passing convergence must emit a selection or a gap');
    const slots = new Set();
    for (const [index, selection] of value.selections.entries()) {
      const key = `${selection.blockRef}:${selection.decisionSlot}`;
      if (slots.has(key)) errors.push(`$.selections[${index}]: duplicate decision slot ${key}`); slots.add(key);
      const owner = selection.owner;
      const expected = `${owner.package}/${owner.layer}/${owner.exportName}`;
      if (owner.exportPath !== expected) errors.push(`$.selections[${index}].owner.exportPath: must equal ${expected}`);
    }
    for (const [index, gap] of value.gaps.entries()) { const key = `${gap.blockRef}:${gap.decisionSlot}`; if (slots.has(key)) errors.push(`$.gaps[${index}]: slot ${key} already has another result`); slots.add(key); }
    scanNeutral(value.selections, '$.selections', errors); scanNeutral(value.gaps, '$.gaps', errors);
  }
  return { ok: !errors.length, errors };
}
export function runCli(validator, label) { const file = process.argv[2]; if (!file || process.argv.length !== 3) { console.error(`usage: node ${label} <artifact.json>`); process.exitCode = 2; return; } let value; try { value = JSON.parse(readFileSync(resolve(file), 'utf8')); } catch (error) { console.error(`${label}: cannot read valid JSON from ${file}: ${error.message}`); process.exitCode = 1; return; } const result = validator(value); if (!result.ok) { result.errors.forEach((error) => console.error(`${label}: ${error}`)); process.exitCode = 1; return; } console.log(`${label}: valid`); }
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) runCli(validateOutput, 'grammar-convergence output');
