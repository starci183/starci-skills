import test from 'node:test';
import assert from 'node:assert/strict';
import { extractCommands } from '../../scripts/checks/lib/doc-commands.mjs';
import { proseCommandFindings } from '../../scripts/checks/check-prose-commands.mjs';

// The two owners of "a documented command exists" (this helper and the prose-commands self-check) read a regex that
// matches a command spelling the same way: as a pattern, never as a command that must exist.
test('a regex pattern over a command spelling is not read as a command by either extractor', () => {
  const pattern = "- {pattern: 'starci\s+supervisor\s+(?:tell|channel)', why: \"an Op never messages the Supervisor\"}";
  assert.deepEqual(extractCommands(pattern), []);
  assert.deepEqual(proseCommandFindings({ 'modules/kernel/roles.yaml': pattern }), []);
});
