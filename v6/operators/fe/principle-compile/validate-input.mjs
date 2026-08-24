import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runCli, validateAgainst } from './validate-output.mjs';

const authorityLeak = /@starci\/|\bSurfaceCard\b|\bSurfaceListCard\b|\bcomplex[- ]case\b|\b(branch|composites)\//i;
export function validateInput(value) {
  const result = validateAgainst(value, 'input');
  if (!result.ok) return result;
  const errors = [];
  const ids = value.openDecisions.map((decision) => decision.decisionId);
  if (new Set(ids).size !== ids.length) errors.push('$.openDecisions: decisionId values must be unique');
  for (const [index, decision] of value.openDecisions.entries()) {
    if (decision.openedByGrammarRef === decision.openedBySourceFitRef) errors.push(`$.openDecisions[${index}]: Grammar and source-fit authorities must be independently traceable`);
    for (const field of ['situation', 'axis']) if (authorityLeak.test(decision[field])) errors.push(`$.openDecisions[${index}].${field}: concrete Grammar authority is not an open Principle decision`);
  }
  return { ok: !errors.length, errors };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) runCli(validateInput, 'principle-compile input');
