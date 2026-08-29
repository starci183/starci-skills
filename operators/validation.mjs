import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function exactObject(value, keys, at, errors) {
  if (!isObject(value)) {
    errors.push(`${at || '/'}: expected object`);
    return false;
  }
  for (const key of keys) if (!(key in value)) errors.push(`${at}/${key}: required`);
  for (const key of Object.keys(value)) if (!keys.includes(key)) errors.push(`${at}/${key}: additional property is forbidden`);
  return true;
}

export function nonEmptyText(value, at, errors) {
  if (typeof value !== 'string' || value.trim().length === 0) errors.push(`${at}: expected non-empty string`);
}

export function uniqueStrings(value, at, errors, { min = 0 } = {}) {
  if (!Array.isArray(value)) {
    errors.push(`${at}: expected array`);
    return [];
  }
  if (value.length < min) errors.push(`${at}: expected at least ${min} item(s)`);
  value.forEach((item, index) => nonEmptyText(item, `${at}/${index}`, errors));
  if (new Set(value).size !== value.length) errors.push(`${at}: duplicate items are forbidden`);
  return value;
}

export function naturalNumber(value, at, errors) {
  if (!Number.isInteger(value) || value < 0) errors.push(`${at}: expected a non-negative integer`);
}

export function validateEnvelope(value, expected, errors) {
  const keys = ['kind', 'schemaVersion', 'appId', 'runId', 'stage', 'status', 'facts', 'payload'];
  if (!exactObject(value, keys, '', errors)) return false;
  if (value.kind !== expected.kind) errors.push(`/kind: expected ${expected.kind}`);
  if (value.schemaVersion !== 6) errors.push('/schemaVersion: expected 6');
  if (value.appId !== 'fe-design-layout') errors.push('/appId: expected fe-design-layout');
  nonEmptyText(value.runId, '/runId', errors);
  if (!expected.routes.some(([stage, status]) => value.stage === stage && value.status === status)) {
    errors.push('/stage: stage and status do not form a declared route');
  }
  const facts = uniqueStrings(value.facts, '/facts', errors);
  return { facts };
}

export async function runValidatorCli(validate, usage) {
  const file = process.argv[2];
  if (!file) throw new Error(usage);
  const value = JSON.parse(await readFile(path.resolve(file), 'utf8'));
  const result = validate(value);
  if (!result.valid) {
    console.error(result.errors.join('\n'));
    process.exitCode = 1;
  }
}

function jsonType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

function resolveLocalRef(schema, ref) {
  if (!ref.startsWith('#/')) throw new Error(`unsupported non-local schema reference ${ref}`);
  return ref.slice(2).split('/').reduce((value, key) => value?.[key.replaceAll('~1', '/').replaceAll('~0', '~')], schema);
}

function inspectSchema(schema, rule, value, at, errors) {
  if (rule.$ref) return inspectSchema(schema, resolveLocalRef(schema, rule.$ref), value, at, errors);
  if (rule.allOf) rule.allOf.forEach((item) => inspectSchema(schema, item, value, at, errors));
  if (rule.oneOf || rule.anyOf) {
    const branches = rule.oneOf ?? rule.anyOf;
    const matches = branches.filter((item) => {
      const branchErrors = [];
      inspectSchema(schema, item, value, at, branchErrors);
      return branchErrors.length === 0;
    }).length;
    if ((rule.oneOf && matches !== 1) || (rule.anyOf && matches === 0)) errors.push(`${at}: no unique allowed schema branch`);
    return;
  }
  if (rule.if) {
    const conditionErrors = [];
    inspectSchema(schema, rule.if, value, at, conditionErrors);
    if (conditionErrors.length === 0 && rule.then) inspectSchema(schema, rule.then, value, at, errors);
    if (conditionErrors.length > 0 && rule.else) inspectSchema(schema, rule.else, value, at, errors);
  }
  if (Object.hasOwn(rule, 'const') && value !== rule.const) errors.push(`${at}: expected ${JSON.stringify(rule.const)}`);
  if (rule.enum && !rule.enum.includes(value)) errors.push(`${at}: value is outside the allowed enum`);
  if (rule.type) {
    const types = Array.isArray(rule.type) ? rule.type : [rule.type];
    const actual = jsonType(value);
    if (!types.some((type) => type === actual || (type === 'number' && typeof value === 'number'))) {
      errors.push(`${at}: expected ${types.join('|')}, got ${actual}`);
      return;
    }
  }
  if (typeof value === 'string') {
    if (rule.minLength !== undefined && value.length < rule.minLength) errors.push(`${at}: string is too short`);
    if (rule.pattern && !new RegExp(rule.pattern).test(value)) errors.push(`${at}: string does not match ${rule.pattern}`);
  }
  if (typeof value === 'number') {
    if (rule.minimum !== undefined && value < rule.minimum) errors.push(`${at}: value is below minimum`);
    if (rule.maximum !== undefined && value > rule.maximum) errors.push(`${at}: value exceeds maximum`);
  }
  if (Array.isArray(value)) {
    if (rule.minItems !== undefined && value.length < rule.minItems) errors.push(`${at}: array is too short`);
    if (rule.maxItems !== undefined && value.length > rule.maxItems) errors.push(`${at}: array is too long`);
    if (rule.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) errors.push(`${at}: duplicate items are forbidden`);
    if (rule.items) value.forEach((item, index) => inspectSchema(schema, rule.items, item, `${at}[${index}]`, errors));
  }
  if (isObject(value)) {
    for (const key of rule.required ?? []) if (!Object.hasOwn(value, key)) errors.push(`${at}.${key}: required`);
    const properties = rule.properties ?? {};
    if (rule.additionalProperties === false) for (const key of Object.keys(value)) if (!Object.hasOwn(properties, key)) errors.push(`${at}.${key}: unexpected property`);
    for (const [key, child] of Object.entries(properties)) if (Object.hasOwn(value, key)) inspectSchema(schema, child, value[key], `${at}.${key}`, errors);
  }
}

function contractHygiene(value) {
  const errors = [];
  if (!isObject(value)) return errors;
  const taskId = value.payload?.session?.taskId;
  const project = value.payload?.provided?.project;
  const expectedProfile = { economical: 'orchestration/modes/economical.json', balanced: 'orchestration/modes/balanced.json', parallel: 'orchestration/modes/parallel.json' };
  const orchestration = value.payload?.loads?.orchestration;
  if (orchestration?.profileRef !== undefined && expectedProfile[orchestration.mode] !== orchestration.profileRef) errors.push('$.payload.loads.orchestration.profileRef: must match mode');
  const visit = (current, at) => {
    if (typeof current === 'string') {
      if (current.length > 4096) errors.push(`${at}: string exceeds the task-contract limit`);
      if (taskId && current.startsWith('session://tasks/') && !current.startsWith(`session://tasks/${taskId}/`)) errors.push(`${at}: foreign task-session reference`);
      if (project) {
        const match = current.match(/^\.worktrees\/([a-z0-9][a-z0-9-]*)\//);
        if (match && match[1] !== project) errors.push(`${at}: cross-project worktree reference`);
      }
      if (!at.endsWith('.$schema') && /(^|[\\/])\.\.([\\/]|$)/.test(current)) errors.push(`${at}: path traversal is forbidden`);
      return;
    }
    if (Array.isArray(current)) {
      if (current.length > 256) errors.push(`${at}: array exceeds the task-contract limit`);
      current.forEach((item, index) => visit(item, `${at}[${index}]`));
      return;
    }
    if (isObject(current)) for (const [key, child] of Object.entries(current)) visit(child, `${at}.${key}`);
  };
  visit(value, '$');
  return errors;
}

export function validatorFor(schemaUrl, semantic = () => []) {
  const schema = JSON.parse(readFileSync(schemaUrl, 'utf8'));
  return (value) => {
    const errors = [];
    inspectSchema(schema, schema, value, '$', errors);
    if (errors.length === 0) errors.push(...contractHygiene(value));
    if (errors.length === 0) errors.push(...semantic(value));
    return { valid: errors.length === 0, errors };
  };
}
