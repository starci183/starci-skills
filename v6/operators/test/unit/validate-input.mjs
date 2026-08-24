import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { exactObject, nonEmptyText, runValidatorCli, uniqueStrings, validateEnvelope } from '../../validation.mjs';

const payloadKeys = ['workspaceRouteRef', 'sourceRole', 'sourceReferenceRef', 'manifestRefs', 'changeSetRef', 'changeSetHash', 'targetRefs', 'evidenceRoot'];
export function validateInput(value) {
  const errors = [];
  const envelope = validateEnvelope(value, { kind: 'test.unit.input', routes: [['test.unit', 'ready']] }, errors);
  if (!envelope) return { valid: false, errors };
  if (!envelope.facts.includes('seed-evidence')) errors.push('/facts: seed-evidence is required');
  if (!exactObject(value.payload, payloadKeys, '/payload', errors)) return { valid: false, errors };
  for (const key of ['workspaceRouteRef', 'changeSetRef', 'changeSetHash', 'evidenceRoot']) nonEmptyText(value.payload[key], `/payload/${key}`, errors);
  uniqueStrings(value.payload.manifestRefs, '/payload/manifestRefs', errors, { min: 1 });
  uniqueStrings(value.payload.targetRefs, '/payload/targetRefs', errors, { min: 1 });
  const match = { fe: 'starci-academy-fe', be: 'starci-academy-be' };
  if (!(value.payload.sourceRole in match)) errors.push('/payload/sourceRole: expected fe or be');
  else if (value.payload.sourceReferenceRef !== match[value.payload.sourceRole]) errors.push('/payload/sourceReferenceRef: must match sourceRole');
  return { valid: errors.length === 0, errors };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) runValidatorCli(validateInput, 'usage: node validate-input.mjs <input.json>').catch((error) => { console.error(error.message); process.exitCode = 1; });
