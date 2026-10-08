import test from 'node:test';
import assert from 'node:assert/strict';
import { proseCommandFindings, checkProseCommands, CODE } from '../../scripts/checks/check-prose-commands.mjs';

test('the shipped instruction surfaces show only catalogued commands and flags', () => {
  assert.deepEqual(checkProseCommands().map((finding) => finding.message), []);
});

test('RT_PROSE_COMMAND_UNKNOWN names file:line for an unknown verb and an unknown flag in spans, fences and yaml examples', () => {
  const doc = 'run `starci kernel settle --job x --bogus 1` or `starci kernel nope`\n```\nstarci workflow bias --normalize x\nstarci debug pass --x\n```\n'; // [removed-list]
  const yaml = 'examples:\n  - starci kernel route --job a --nonsense\n';
  const findings = proseCommandFindings({ 'docs/a.md': doc, 'modules/a/b.yaml': yaml });
  assert.deepEqual(findings.map((finding) => [finding.code, finding.path, finding.line]), [
    [CODE, 'docs/a.md', 1], [CODE, 'docs/a.md', 1], [CODE, 'docs/a.md', 4], [CODE, 'modules/a/b.yaml', 2]]);
  assert.match(findings[0].message, /docs\/a\.md:1 starci kernel settle has no flag --bogus/);
});

test('RT_PROSE_COMMAND_UNKNOWN reads a chain one command at a time and ignores another program after a lone --, prose and marked lines', () => {
  const doc = '```\nstarci kernel report --job a → starci kernel settle --job a --verdict pass\nstarci runtime check --only cli-parity -- --root x\n```\nprose: starci kernel dispatch --nonsense\n`starci debug pass` [removed-list]\n';
  assert.deepEqual(proseCommandFindings({ 'docs/a.md': doc }), []);
});
