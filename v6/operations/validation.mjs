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
