// The one JSON Schema checker the tree uses: the same subset every operator's validation.mjs carried
// (types, enum, const, $ref local, allOf/oneOf/anyOf, if/then/else, string, number, array and object
// keywords), lifted to scripts/ so validate-step, the kind schemas under templates/kinds, and the step
// gates under templates/step share one implementation.
import { readFileSync } from 'node:fs';

function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function jsonType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}
function resolveLocalRef(schema, ref) {
  if (!ref.startsWith('#/')) throw new Error(`unsupported non-local schema reference ${ref}`);
  return ref.slice(2).split('/').reduce((current, key) => current?.[key.replaceAll('~1', '/').replaceAll('~0', '~')], schema);
}
function inspect(schema, rule, value, at, errors) {
  if (rule.$ref) return inspect(schema, resolveLocalRef(schema, rule.$ref), value, at, errors);
  for (const item of rule.allOf ?? []) inspect(schema, item, value, at, errors);
  if (rule.oneOf || rule.anyOf) {
    const branches = rule.oneOf ?? rule.anyOf;
    const matches = branches.filter((branch) => { const e = []; inspect(schema, branch, value, at, e); return e.length === 0; }).length;
    if ((rule.oneOf && matches !== 1) || (rule.anyOf && matches === 0)) errors.push(`${at}: no unique allowed schema branch`);
    return;
  }
  if (rule.if) {
    const c = []; inspect(schema, rule.if, value, at, c);
    if (c.length === 0 && rule.then) inspect(schema, rule.then, value, at, errors);
    if (c.length > 0 && rule.else) inspect(schema, rule.else, value, at, errors);
  }
  if (Object.hasOwn(rule, 'const') && value !== rule.const) errors.push(`${at}: expected ${JSON.stringify(rule.const)}`);
  if (rule.enum && !rule.enum.includes(value)) errors.push(`${at}: value is outside the allowed enum`);
  if (rule.type) {
    const types = Array.isArray(rule.type) ? rule.type : [rule.type];
    const actual = jsonType(value);
    if (!types.some((type) => type === actual || (type === 'number' && typeof value === 'number'))) { errors.push(`${at}: expected ${types.join('|')}, got ${actual}`); return; }
  }
  if (typeof value === 'string') {
    if (rule.minLength !== undefined && value.length < rule.minLength) errors.push(`${at}: string is too short`);
    if (rule.maxLength !== undefined && value.length > rule.maxLength) errors.push(`${at}: string is too long`);
    if (rule.pattern && !new RegExp(rule.pattern).test(value)) errors.push(`${at}: string does not match ${rule.pattern}`);
    if (rule.format === 'date-time' && Number.isNaN(Date.parse(value))) errors.push(`${at}: invalid date-time`);
  }
  if (typeof value === 'number') {
    if (rule.minimum !== undefined && value < rule.minimum) errors.push(`${at}: value is below minimum`);
    if (rule.maximum !== undefined && value > rule.maximum) errors.push(`${at}: value exceeds maximum`);
  }
  if (Array.isArray(value)) {
    if (rule.minItems !== undefined && value.length < rule.minItems) errors.push(`${at}: array is too short`);
    if (rule.maxItems !== undefined && value.length > rule.maxItems) errors.push(`${at}: array is too long`);
    if (rule.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) errors.push(`${at}: duplicate items are forbidden`);
    if (rule.items) value.forEach((item, index) => inspect(schema, rule.items, item, `${at}[${index}]`, errors));
  }
  if (isObject(value)) {
    for (const key of rule.required ?? []) if (!Object.hasOwn(value, key)) errors.push(`${at}.${key}: required`);
    const properties = rule.properties ?? {};
    if (rule.additionalProperties === false) for (const key of Object.keys(value)) if (!Object.hasOwn(properties, key)) errors.push(`${at}.${key}: unexpected property`);
    else if (isObject(rule.additionalProperties)) for (const [key, child] of Object.entries(value)) if (!Object.hasOwn(properties, key)) inspect(schema, rule.additionalProperties, child, `${at}.${key}`, errors);
    for (const [key, child] of Object.entries(properties)) if (Object.hasOwn(value, key)) inspect(schema, child, value[key], `${at}.${key}`, errors);
  }
}
// Path traversal and unbounded strings are refused everywhere, whatever the schema says.
function hygiene(value) {
  const errors = [];
  const visit = (current, at) => {
    if (typeof current === 'string') {
      if (current.length > 8192) errors.push(`${at}: string exceeds the contract limit`);
      if (!at.endsWith('.$schema') && /(^|[\\/])\.\.([\\/]|$)/.test(current) && !/^\.\.\/step-\d+-\d+\//.test(current)) errors.push(`${at}: path traversal is forbidden`);
      return;
    }
    if (Array.isArray(current)) { if (current.length > 512) errors.push(`${at}: array exceeds the contract limit`); current.forEach((item, i) => visit(item, `${at}[${i}]`)); return; }
    if (isObject(current)) for (const [key, child] of Object.entries(current)) visit(child, `${at}.${key}`);
  };
  visit(value, '$');
  return errors;
}
export function validateAgainst(schema, value, at = '$') {
  const errors = [];
  inspect(schema, schema, value, at, errors);
  if (errors.length === 0) errors.push(...hygiene(value));
  return errors;
}

// The shape the old per-operator validation.mjs exported; scripts/workspace-portable.mjs (called by the
// backend package.json) still builds its route validators this way.
export function validatorFor(schemaUrl, semantic = () => []) {
  const schema = JSON.parse(readFileSync(schemaUrl, 'utf8'));
  return (value) => {
    const errors = validateAgainst(schema, value);
    if (errors.length === 0) errors.push(...semantic(value));
    return { valid: errors.length === 0, errors };
  };
}
