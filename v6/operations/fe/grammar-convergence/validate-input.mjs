import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runCli, validateAgainst } from './validate-output.mjs';

const forbidden = /(?:^|[-_./])(customer|user|student|course|vps|server|price|payment|order|subscription|entitlement|business|refund|purchase)(?:$|[-_./])/i;
function scan(value, at, errors) { if (typeof value === 'string' && forbidden.test(value)) errors.push(`${at}: business-bearing token is forbidden in Grammar input`); else if (Array.isArray(value)) value.forEach((item, i) => scan(item, `${at}[${i}]`, errors)); else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) scan(item, `${at}.${key}`, errors); }
export function validateInput(value) {
  const result = validateAgainst(value, 'input');
  if (!result.ok) return result;
  const errors = [];
  const dependencies = value.grammarLock.declaredDependencies.map((item) => `${item.package}@${item.version}`);
  if (new Set(dependencies).size !== dependencies.length) errors.push('$.grammarLock.declaredDependencies: package-version locks must be unique');
  const blockRefs = value.neutralBlocks.map((block) => block.blockRef);
  if (new Set(blockRefs).size !== blockRefs.length) errors.push('$.neutralBlocks: blockRef values must be unique');
  for (const [index, block] of value.neutralBlocks.entries()) {
    const facts = [...block.structuralFacts, ...block.interactionFacts, ...block.presentationFacts];
    if (new Set(facts).size !== facts.length) errors.push(`$.neutralBlocks[${index}]: a fact may belong to only one vocabulary class`);
  }
  scan(value.neutralBlocks, '$.neutralBlocks', errors);
  return { ok: !errors.length, errors };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) runCli(validateInput, 'grammar-convergence input');
