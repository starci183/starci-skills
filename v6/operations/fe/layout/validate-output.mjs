import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const schemas = {
  input: JSON.parse(readFileSync(new URL('./input.schema.json', import.meta.url), 'utf8')),
  output: JSON.parse(readFileSync(new URL('./output.schema.json', import.meta.url), 'utf8'))
};
let schema = schemas.output;

function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function localRef(ref) {
  if (!ref.startsWith('#/')) throw new Error(`unsupported non-local schema ref: ${ref}`);
  return ref.slice(2).split('/').reduce((value, key) => value[key.replaceAll('~1', '/').replaceAll('~0', '~')], schema);
}
function inspect(value, rule, at, errors) {
  if (rule.$ref) inspect(value, localRef(rule.$ref), at, errors);
  if (rule.allOf) rule.allOf.forEach((part) => inspect(value, part, at, errors));
  if (rule.oneOf) {
    const attempts = rule.oneOf.map((part) => { const found = []; inspect(value, part, at, found); return found; });
    const passing = attempts.filter((found) => found.length === 0).length;
    if (passing !== 1) {
      errors.push(`${at}: expected exactly one schema branch, matched ${passing}`);
      if (passing === 0) errors.push(...attempts.reduce((best, found) => found.length < best.length ? found : best));
    }
    return;
  }
  if ('const' in rule && !same(value, rule.const)) errors.push(`${at}: must equal ${JSON.stringify(rule.const)}`);
  if (rule.enum && !rule.enum.some((item) => same(value, item))) errors.push(`${at}: must be one of ${rule.enum.map(JSON.stringify).join(', ')}`);
  const types = Array.isArray(rule.type) ? rule.type : rule.type ? [rule.type] : [];
  if (types.length) {
    const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : Number.isInteger(value) ? 'integer' : typeof value;
    const matches = types.some((type) => type === actual || (type === 'number' && typeof value === 'number'));
    if (!matches) { errors.push(`${at}: expected ${types.join('|')}, got ${actual}`); return; }
  }
  if (typeof value === 'string') {
    if (rule.minLength !== undefined && value.length < rule.minLength) errors.push(`${at}: must contain at least ${rule.minLength} character(s)`);
    if (rule.pattern && !(new RegExp(rule.pattern).test(value))) errors.push(`${at}: does not match ${rule.pattern}`);
  }
  if (typeof value === 'number') {
    if (rule.minimum !== undefined && value < rule.minimum) errors.push(`${at}: must be >= ${rule.minimum}`);
    if (rule.maximum !== undefined && value > rule.maximum) errors.push(`${at}: must be <= ${rule.maximum}`);
  }
  if (Array.isArray(value)) {
    if (rule.minItems !== undefined && value.length < rule.minItems) errors.push(`${at}: needs at least ${rule.minItems} item(s)`);
    if (rule.maxItems !== undefined && value.length > rule.maxItems) errors.push(`${at}: allows at most ${rule.maxItems} item(s)`);
    if (rule.uniqueItems && new Set(value.map(JSON.stringify)).size !== value.length) errors.push(`${at}: items must be unique`);
    if (rule.items) value.forEach((item, index) => inspect(item, rule.items, `${at}[${index}]`, errors));
    if (rule.contains && !value.some((item, index) => { const found = []; inspect(item, rule.contains, `${at}[${index}]`, found); return found.length === 0; })) errors.push(`${at}: does not contain the required item`);
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of rule.required ?? []) if (!(key in value)) errors.push(`${at}.${key}: required`);
    const properties = rule.properties ?? {};
    if (rule.additionalProperties === false) for (const key of Object.keys(value)) if (!(key in properties)) errors.push(`${at}.${key}: unknown field`);
    for (const [key, child] of Object.entries(properties)) if (key in value) inspect(value[key], child, `${at}.${key}`, errors);
  }
}

export function validateAgainst(value, definition) {
  const errors = [];
  schema = schemas[definition];
  if (!schema) return { ok: false, errors: [`$: missing schema direction ${definition}`] };
  inspect(value, schema, '$', errors);
  return { ok: errors.length === 0, errors };
}

export function validateOutput(value) {
  const result = validateAgainst(value, 'output');
  if (!result.ok) return result;
  const errors = [];
  const ids = value.directions.map((direction) => direction.id);
  if (new Set(ids).size !== ids.length) errors.push('$.directions: direction ids must be unique');
  if (!ids.includes(value.recommendation)) errors.push('$.recommendation: must name one emitted direction');
  const expectedCommands = new Set(ids.map((id) => `OK LAYOUT ${id}`));
  if (value.approval.commands.length !== expectedCommands.size || value.approval.commands.some((command) => !expectedCommands.has(command))) errors.push('$.approval.commands: must contain exactly one command per direction');
  if (new Set(value.directions.map((direction) => direction.compositionHash)).size !== value.directions.length) errors.push('$.directions: composition hashes must be materially distinct');
  for (const [directionIndex, direction] of value.directions.entries()) {
    const pageIds = direction.pages.map((page) => page.pageId);
    if (new Set(pageIds).size !== pageIds.length) errors.push(`$.directions[${directionIndex}].pages: page ids must be unique`);
    for (const [pageIndex, page] of direction.pages.entries()) {
      const expected = new Set(page.readingOrder);
      for (const viewport of ['wide', 'intermediate', 'compact']) {
        const placements = page[viewport].placements;
        const placed = placements.map((item) => item.blockId);
        if (new Set(placed).size !== placed.length) errors.push(`$.directions[${directionIndex}].pages[${pageIndex}].${viewport}.placements: a block may be placed only once`);
        if (placed.some((id) => !expected.has(id)) || [...expected].some((id) => !placed.includes(id))) errors.push(`$.directions[${directionIndex}].pages[${pageIndex}].${viewport}: placements must preserve the complete reading-order block set`);
        for (const [placementIndex, placement] of placements.entries()) {
          const trackIds = page[viewport].tracks.map((track) => track.id);
          if (!trackIds.includes(placement.trackId)) errors.push(`$.directions[${directionIndex}].pages[${pageIndex}].${viewport}.placements[${placementIndex}].trackId: unknown track`);
          if (placement.persistence.kind === 'sticky' && (!placement.persistence.scrollOwner || !placement.persistence.releaseCondition)) errors.push(`$.directions[${directionIndex}].pages[${pageIndex}].${viewport}.placements[${placementIndex}].persistence: sticky requires scrollOwner and releaseCondition`);
        }
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

export function runCli(validator, label) {
  const file = process.argv[2];
  if (!file || process.argv.length !== 3) { console.error(`usage: node ${label} <artifact.json>`); process.exitCode = 2; return; }
  let value;
  try { value = JSON.parse(readFileSync(resolve(file), 'utf8')); }
  catch (error) { console.error(`${label}: cannot read valid JSON from ${file}: ${error.message}`); process.exitCode = 1; return; }
  const result = validator(value);
  if (!result.ok) { for (const error of result.errors) console.error(`${label}: ${error}`); process.exitCode = 1; return; }
  console.log(`${label}: valid`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) runCli(validateOutput, 'layout output');
