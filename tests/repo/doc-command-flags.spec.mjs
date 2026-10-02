import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { CATALOG } from '../../packages/cli/src/catalog.generated.mjs';
import { docCommandFiles, problemsIn } from '../helpers/doc-commands.mjs';

// Every `starci <group> <verb> <flags>` shown to an agent or owner is a call the dispatcher would accept:
// known verb, declared flags, valid enum values, required flags and positionals present (fragments excepted).
const ROOT = path.resolve(import.meta.dirname, '..', '..');

test('documented starci commands are valid calls against the generated catalog', () => {
  const bad = docCommandFiles(ROOT).flatMap((file) => problemsIn(ROOT, file, CATALOG));
  assert.deepEqual(bad, []);
});
