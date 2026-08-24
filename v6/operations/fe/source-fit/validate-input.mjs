import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runCli, validateAgainst } from './validate-output.mjs';

function subset(values, allowed) { const set = new Set(allowed); return values.every((value) => set.has(value)); }
function checkEffective(contract, at, errors) { if (!subset(contract.sourceDelta.boundSlots, contract.slots)) errors.push(`${at}.sourceDelta.boundSlots: unknown slot`); if (!subset(contract.sourceDelta.boundStateInputs, contract.stateInputs)) errors.push(`${at}.sourceDelta.boundStateInputs: unknown state input`); if (!subset(contract.sourceDelta.resolvedVariableAxes, contract.variableAxes)) errors.push(`${at}.sourceDelta.resolvedVariableAxes: closed axis`); for (const required of ['anatomy', 'closed-invariant', 'owner-substitution']) if (!contract.extensionPolicy.forbidden.includes(required)) errors.push(`${at}.extensionPolicy.forbidden: must include ${required}`); }
export function validateInput(value) {
  const result = validateAgainst(value, 'input');
  if (!result.ok) return result;
  const errors = [];
  const candidateIds = value.candidates.map((candidate) => candidate.candidateId);
  const knownCandidates = new Set(candidateIds);
  if (knownCandidates.size !== candidateIds.length) errors.push('$.candidates: candidateId values must be unique');
  const ownerRefs = value.requirements.map((requirement) => requirement.ownerRef);
  if (new Set(ownerRefs).size !== ownerRefs.length) errors.push('$.requirements: ownerRef values must be unique');
  value.candidates.forEach((candidate, index) => checkEffective(candidate.effectiveContract, `$.candidates[${index}].effectiveContract`, errors));
  value.requirements.forEach((requirement, index) => requirement.candidateIds.forEach((candidateId) => { if (!knownCandidates.has(candidateId)) errors.push(`$.requirements[${index}].candidateIds: unknown candidate ${candidateId}`); }));
  return { ok: !errors.length, errors };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) runCli(validateInput, 'source-fit input');
