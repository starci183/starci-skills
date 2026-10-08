import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CATALOG } from '../../packages/cli/src/catalog.generated.mjs';
import { checkCommand, docCommandFiles, extractCommands } from '../helpers/doc-commands.mjs';
import { proseCommandFindings } from '../../scripts/checks/check-prose-commands.mjs';

// Every `starci <group> <verb>` an agent or owner is told to run exists in the generated command catalog.
// The extraction and the flag-level proof live in tests/helpers/doc-commands.mjs and tests/repo/doc-command-flags.spec.mjs.
const ROOT = path.resolve(import.meta.dirname, '..', '..');

test('docs, skills, op contracts, knowledge and hint scripts name only generated starci groups and verbs', () => {
  const bad = [];
  for (const file of docCommandFiles(ROOT)) {
    const name = path.relative(ROOT, file).split(path.sep).join('/');
    const text = fs.readFileSync(file, 'utf8');
    if (!text.includes('starci')) continue;
    for (const occurrence of extractCommands(text, { kind: file.endsWith('.mjs') ? 'script' : 'text' })) {
      for (const reason of checkCommand(occurrence, CATALOG)) {
        if (/^unknown (group|verb)/.test(reason)) bad.push(`${name}:${occurrence.line} ${reason}`);
      }
    }
  }
  assert.deepEqual(bad, []);
});

// The two owners of "a documented command exists" (this helper and the prose-commands self-check) read a regex that
// matches a command spelling the same way: as a pattern, never as a command that must exist.
test('a regex pattern over a command spelling is not read as a command by either extractor', () => {
  const pattern = "- {pattern: 'starci\s+supervisor\s+(?:tell|channel)', why: \"an Op never messages the Supervisor\"}";
  assert.deepEqual(extractCommands(pattern), []);
  assert.deepEqual(proseCommandFindings({ 'modules/kernel/roles.yaml': pattern }), []);
});
