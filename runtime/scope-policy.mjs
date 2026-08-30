import fs from 'node:fs';
import { validatorFor } from '../operators/validation.mjs';

const validatePolicy = validatorFor(new URL('./scope-policy.schema.json', import.meta.url));

function parseScalar(raw) {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  if (/^-?\d+$/.test(raw)) return Number(raw);
  if (raw.startsWith('[') || raw.startsWith('{')) return JSON.parse(raw);
  return raw;
}

export function loadScopePolicy(file = new URL('../scope.yaml', import.meta.url)) {
  const text = fs.readFileSync(file, 'utf8');
  const value = Object.fromEntries(text.split(/\r?\n/).filter((line) => line.trim()).map((line) => {
    const [key, ...rest] = line.split(':');
    return [key.trim(), parseScalar(rest.join(':').trim())];
  }));
  const result = validatePolicy(value);
  if (!result.valid) throw new Error(result.errors.join('; '));
  return Object.freeze(value);
}

export function findScopeDimension(scope, key) {
  return scope?.dimensions?.find((dimension) => dimension.key === key) ?? null;
}
