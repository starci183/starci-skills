import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { validateAgainst } from './json-schema.mjs';

export async function validateMigrationOperation(root, operation, at) {
  const schema = JSON.parse(await readFile(path.join(root, 'templates/kinds/stack-model.schema.json'), 'utf8'));
  const rule = schema.$defs.migrationOperation;
  if (operation?.transport !== rule.properties.transport.const) return [];
  const errors = validateAgainst(rule, operation, at);
  if (!Array.isArray(operation.migrationRefs) || !operation.migrationRefs.includes(operation.writerRef)) {
    errors.push(`${at}: migration writer must be one of its migrationRefs`);
  }
  for (const ref of [operation.writerRef, ...(Array.isArray(operation.migrationRefs) ? operation.migrationRefs : [])]) {
    if (typeof ref !== 'string' || path.isAbsolute(ref) || path.win32.isAbsolute(ref) || /[\\:\0]/.test(ref) || ref.split('/').some(part => !part || part === '.' || part === '..')) {
      errors.push(`${at}: migration file references must be relative to the bound checkout`);
    }
  }
  return errors;
}
