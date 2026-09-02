import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function jsonType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

function resolveLocalRef(schema, ref) {
  if (!ref.startsWith('#/')) throw new Error(`unsupported non-local schema reference ${ref}`);
  return ref
    .slice(2)
    .split('/')
    .reduce((current, key) => current?.[key.replaceAll('~1', '/').replaceAll('~0', '~')], schema);
}

function inspectSchema(schema, rule, value, at, errors) {
  if (rule.$ref) return inspectSchema(schema, resolveLocalRef(schema, rule.$ref), value, at, errors);

  for (const item of rule.allOf ?? []) inspectSchema(schema, item, value, at, errors);

  if (rule.oneOf || rule.anyOf) {
    const branches = rule.oneOf ?? rule.anyOf;
    const matches = branches.filter((branch) => {
      const branchErrors = [];
      inspectSchema(schema, branch, value, at, branchErrors);
      return branchErrors.length === 0;
    }).length;
    if ((rule.oneOf && matches !== 1) || (rule.anyOf && matches === 0)) {
      errors.push(`${at}: no unique allowed schema branch`);
    }
    return;
  }

  if (rule.if) {
    const conditionErrors = [];
    inspectSchema(schema, rule.if, value, at, conditionErrors);
    if (conditionErrors.length === 0 && rule.then) inspectSchema(schema, rule.then, value, at, errors);
    if (conditionErrors.length > 0 && rule.else) inspectSchema(schema, rule.else, value, at, errors);
  }

  if (Object.hasOwn(rule, 'const') && value !== rule.const) {
    errors.push(`${at}: expected ${JSON.stringify(rule.const)}`);
  }
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
    if (rule.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) {
      errors.push(`${at}: duplicate items are forbidden`);
    }
    if (rule.items) value.forEach((item, index) => inspectSchema(schema, rule.items, item, `${at}[${index}]`, errors));
  }

  if (isObject(value)) {
    for (const key of rule.required ?? []) {
      if (!Object.hasOwn(value, key)) errors.push(`${at}.${key}: required`);
    }
    const properties = rule.properties ?? {};
    if (rule.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(properties, key)) errors.push(`${at}.${key}: unexpected property`);
      }
    }
    for (const [key, child] of Object.entries(properties)) {
      if (Object.hasOwn(value, key)) inspectSchema(schema, child, value[key], `${at}.${key}`, errors);
    }
  }
}

function hygiene(value) {
  const errors = [];
  const visit = (current, at) => {
    if (typeof current === 'string') {
      if (current.length > 8192) errors.push(`${at}: string exceeds the operator contract limit`);
      if (!at.endsWith('.$schema') && /(^|[\\/])\.\.([\\/]|$)/.test(current)) {
        errors.push(`${at}: path traversal is forbidden`);
      }
      return;
    }
    if (Array.isArray(current)) {
      if (current.length > 512) errors.push(`${at}: array exceeds the operator contract limit`);
      current.forEach((item, index) => visit(item, `${at}[${index}]`));
      return;
    }
    if (isObject(current)) {
      for (const [key, child] of Object.entries(current)) visit(child, `${at}.${key}`);
    }
  };
  visit(value, '$');
  return errors;
}

export function validatorFor(schemaUrl, semantic = () => []) {
  const schema = JSON.parse(readFileSync(schemaUrl, 'utf8'));
  return (value) => {
    const errors = [];
    inspectSchema(schema, schema, value, '$', errors);
    if (errors.length === 0) errors.push(...hygiene(value));
    if (errors.length === 0) errors.push(...semantic(value));
    return { valid: errors.length === 0, errors };
  };
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

