import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { exactObject, nonEmptyText, runValidatorCli, uniqueStrings, validateEnvelope } from '../../validation.mjs';

const payloadKeys = ['workspaceRouteRefs', 'sourceReferenceRefs', 'manifestRefs', 'selectedFlowRef', 'selectedFlowHash', 'seedEvidenceRef', 'seedEvidenceHash', 'scenarioRefs', 'environmentRef', 'credentialProviderRef', 'evidenceRoot'];
export function validateInput(value) {
  const errors = [];
  const envelope = validateEnvelope(value, { kind: 'test.e2e.input', routes: [['test.e2e', 'ready']] }, errors);
  if (!envelope) return { valid: false, errors };
  for (const fact of ['unit-pass', 'unit-evidence', 'seed-evidence']) if (!envelope.facts.includes(fact)) errors.push(`/facts: ${fact} is required`);
  if (!exactObject(value.payload, payloadKeys, '/payload', errors)) return { valid: false, errors };
  if (exactObject(value.payload.workspaceRouteRefs, ['fe', 'be'], '/payload/workspaceRouteRefs', errors)) {
    nonEmptyText(value.payload.workspaceRouteRefs.fe, '/payload/workspaceRouteRefs/fe', errors); nonEmptyText(value.payload.workspaceRouteRefs.be, '/payload/workspaceRouteRefs/be', errors);
  }
  const refs = uniqueStrings(value.payload.sourceReferenceRefs, '/payload/sourceReferenceRefs', errors, { min: 2 });
  if (refs.length !== 2 || refs[0] !== 'starci-academy-fe' || refs[1] !== 'starci-academy-be') errors.push('/payload/sourceReferenceRefs: expected FE then BE immutable references');
  uniqueStrings(value.payload.manifestRefs, '/payload/manifestRefs', errors, { min: 2 }); uniqueStrings(value.payload.scenarioRefs, '/payload/scenarioRefs', errors, { min: 1 });
  for (const key of ['selectedFlowRef', 'selectedFlowHash', 'seedEvidenceRef', 'seedEvidenceHash', 'environmentRef', 'credentialProviderRef', 'evidenceRoot']) nonEmptyText(value.payload[key], `/payload/${key}`, errors);
  if (JSON.stringify(value).match(/"(password|token|secret)"\s*:/i)) errors.push('/payload: raw credential-shaped fields are forbidden');
  return { valid: errors.length === 0, errors };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) runValidatorCli(validateInput, 'usage: node validate-input.mjs <input.json>').catch((error) => { console.error(error.message); process.exitCode = 1; });
