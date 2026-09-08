// The one JSON Schema checker the tree uses: the same subset every operator's validation.mjs carried
// (types, enum, const, $ref local, allOf/oneOf/anyOf, if/then/else, string, number, array and object
// keywords), lifted to scripts/ so validate-step, the kind schemas under templates/kinds, and the step
// gates under templates/step share one implementation.
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

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
function inspect(schema, rule, value, at, errors, arrayLimits = new Map(), location = [], contentLocations = new Map()) {
  if (rule === true) return;
  if (rule === false) { errors.push(`${at}: false schema forbids this value`); return; }
  if (rule.$ref) inspect(schema, resolveLocalRef(schema, rule.$ref), value, at, errors, arrayLimits, location, contentLocations);
  if (typeof value === 'string') {
    const key = JSON.stringify(location);
    if (rule.type || rule.pattern || rule.format || Object.hasOwn(rule, 'x-content')) {
      const allowed = rule['x-content'] === 'source-text';
      contentLocations.set(key, (contentLocations.get(key) ?? true) && allowed);
    }
  }
  for (const item of rule.allOf ?? []) inspect(schema, item, value, at, errors, arrayLimits, location, contentLocations);
  for (const combinator of ['oneOf', 'anyOf']) {
    if (!rule[combinator]) continue;
    const branches = rule[combinator];
    const matches = branches.map((branch) => { const e = []; const limits = new Map(), content = new Map(); inspect(schema, branch, value, at, e, limits, location, content); return { e, limits, content }; }).filter(({ e }) => e.length === 0);
    if ((combinator === 'oneOf' && matches.length !== 1) || (combinator === 'anyOf' && matches.length === 0)) errors.push(`${at}: no unique allowed schema branch`);
    else {
      for (const key of new Set(matches.flatMap(({ content }) => [...content.keys()]))) {
        const allowed = matches.every(({ content }) => content.get(key) === true);
        contentLocations.set(key, (contentLocations.get(key) ?? true) && allowed);
      }
      const alternatives = new Map();
      for (const { limits } of matches) for (const [array, limit] of limits) alternatives.set(array, Math.max(alternatives.get(array) ?? 0, limit));
      for (const [array, limit] of alternatives) arrayLimits.set(array, Math.min(arrayLimits.get(array) ?? Infinity, limit));
    }
  }
  if (Object.hasOwn(rule, 'if')) {
    const c = []; inspect(schema, rule.if, value, at, c);
    if (c.length === 0 && Object.hasOwn(rule, 'then')) inspect(schema, rule.then, value, at, errors, arrayLimits, location, contentLocations);
    if (c.length > 0 && Object.hasOwn(rule, 'else')) inspect(schema, rule.else, value, at, errors, arrayLimits, location, contentLocations);
  }
  if (Object.hasOwn(rule, 'const') && !isDeepStrictEqual(value, rule.const)) errors.push(`${at}: expected ${JSON.stringify(rule.const)}`);
  if (rule.enum && !rule.enum.some(item => isDeepStrictEqual(item, value))) errors.push(`${at}: value is outside the allowed enum`);
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
    if (Number.isSafeInteger(rule.maxItems) && rule.maxItems >= 0) arrayLimits.set(JSON.stringify(location), Math.min(arrayLimits.get(JSON.stringify(location)) ?? Infinity, rule.maxItems));
    if (rule.minItems !== undefined && value.length < rule.minItems) errors.push(`${at}: array is too short`);
    if (rule.maxItems !== undefined && value.length > rule.maxItems) errors.push(`${at}: array is too long`);
    if (rule.uniqueItems && value.some((item, index) => value.slice(0, index).some(previous => isDeepStrictEqual(previous, item)))) errors.push(`${at}: duplicate items are forbidden`);
    if (Object.hasOwn(rule, 'items')) value.forEach((item, index) => inspect(schema, rule.items, item, `${at}[${index}]`, errors, arrayLimits, [...location, index], contentLocations));
  }
  if (isObject(value)) {
    for (const key of rule.required ?? []) if (!Object.hasOwn(value, key)) errors.push(`${at}.${key}: required`);
    const properties = rule.properties ?? {};
    if (rule.propertyNames) for (const key of Object.keys(value)) inspect(schema, rule.propertyNames, key, `${at} property ${JSON.stringify(key)}`, errors);
    if (rule.additionalProperties === false) {
      for (const key of Object.keys(value)) if (!Object.hasOwn(properties, key)) errors.push(`${at}.${key}: unexpected property`);
    } else if (isObject(rule.additionalProperties)) {
      for (const [key, child] of Object.entries(value)) if (!Object.hasOwn(properties, key)) inspect(schema, rule.additionalProperties, child, `${at}.${key}`, errors, arrayLimits, [...location, key], contentLocations);
    }
    for (const [key, child] of Object.entries(properties)) if (Object.hasOwn(value, key)) inspect(schema, child, value[key], `${at}.${key}`, errors, arrayLimits, [...location, key], contentLocations);
  }
}
// Reference hygiene is the default. Only schema-declared source text is opaque content;
// universal size limits still apply, and payload fields cannot grant an exemption.
function hygiene(value, arrayLimits, contentLocations, rootAt) {
  const errors = [];
  const visit = (current, at, location = []) => {
    if (typeof current === 'string') {
      if (current.length > 8192) errors.push(`${at}: string exceeds the contract limit`);
      if (contentLocations.get(JSON.stringify(location)) !== true && !at.endsWith('.$schema') && /(^|[\\/])\.\.([\\/]|$)/.test(current) && !/^\.\.\/step-\d+-\d+\//.test(current)) errors.push(`${at}: path traversal is forbidden`);
      return;
    }
    if (Array.isArray(current)) { if (current.length > (arrayLimits.get(JSON.stringify(location)) ?? 512)) errors.push(`${at}: array exceeds the contract limit`); current.forEach((item, i) => visit(item, `${at}[${i}]`, [...location, i])); return; }
    if (isObject(current)) for (const [key, child] of Object.entries(current)) visit(child, `${at}.${key}`, [...location, key]);
  };
  visit(value, rootAt);
  return errors;
}
// Fail closed on unsupported assertions, including in branches the instance does not take.
// The final four names are existing repository metadata, not validation keywords.
const keywords = new Set('$schema $id $ref $defs definitions title description default examples type enum const allOf oneOf anyOf if then else minLength maxLength pattern format minimum maximum minItems maxItems uniqueItems items required properties propertyNames additionalProperties x-content review templates production non-production'.split(' '));
function schemaErrors(root) {
  const errors = [];
  const walk = (rule, at) => {
    if (typeof rule === 'boolean') return;
    if (!isObject(rule)) { errors.push(`${at}: schema must be an object or boolean`); return; }
    for (const key of Object.keys(rule)) if (!keywords.has(key)) errors.push(`${at}: unsupported schema keyword ${key}`);
    if (rule.format !== undefined && rule.format !== 'date-time') errors.push(`${at}: unsupported schema format ${rule.format}`);
    if (rule['x-content'] !== undefined && rule['x-content'] !== 'source-text') errors.push(`${at}: unsupported x-content annotation`);
    if (rule.$ref !== undefined) {
      try { if (typeof rule.$ref !== 'string' || resolveLocalRef(root, rule.$ref) === undefined) errors.push(`${at}: unresolved schema reference`); }
      catch (error) { errors.push(`${at}: ${error.message}`); }
    }
    for (const key of ['$defs', 'definitions', 'properties']) if (rule[key] !== undefined) {
      if (!isObject(rule[key])) errors.push(`${at}.${key}: expected schema map`);
      else for (const [name, child] of Object.entries(rule[key])) walk(child, `${at}.${key}.${name}`);
    }
    for (const key of ['allOf', 'oneOf', 'anyOf']) if (rule[key] !== undefined) {
      if (!Array.isArray(rule[key]) || rule[key].length === 0) errors.push(`${at}.${key}: expected nonempty schema array`);
      else rule[key].forEach((child, index) => walk(child, `${at}.${key}[${index}]`));
    }
    for (const key of ['items', 'additionalProperties', 'propertyNames', 'if', 'then', 'else']) if (Object.hasOwn(rule, key)) walk(rule[key], `${at}.${key}`);
  };
  walk(root, '$schema');
  return errors;
}
export function validateAgainst(schema, value, at = '$') {
  const errors = schemaErrors(schema);
  if (errors.length) return errors;
  const arrayLimits = new Map(), contentLocations = new Map();
  inspect(schema, schema, value, at, errors, arrayLimits, [], contentLocations);
  if (errors.length === 0) errors.push(...hygiene(value, arrayLimits, contentLocations, at));
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
