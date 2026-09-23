import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Owner ruling 2026-09-23: "ghi code tiếng anh còn log là tiếng theo config.yaml",
// for ops and kernels alike. Kernels narrated in English while config.yaml said vi.
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('ops, the driver loop and the kernel prompt say: code English, logs in config.yaml language', () => {
  const common = read('modules/ops/_common.yaml');
  assert.match(common, /Language - code English, logs in owner_language/);
  assert.match(common, /orchestration message subjects and bodies/);
  assert.match(read('modules/kernel/driver-loop.yaml'), /Owner rule: code is English, logs are in config\.yaml `language`/);
  const prompt = read('modules/kernel/kernel-prompt.md');
  assert.match(prompt, /LANGUAGE — owner rule: code is English, logs are in config\.yaml `language` \(\{ownerLanguage\}\)/);
});

test('every placeholder in the kernel prompt is filled by start-workflow', () => {
  const placeholders = [...new Set(read('modules/kernel/kernel-prompt.md').match(/\{[a-zA-Z]+\}/g))];
  const source = read('scripts/kernel/start-workflow.mjs');
  const missing = placeholders.filter((p) => !source.includes(`.replaceAll('${p}'`));
  assert.deepEqual(missing, [], 'a placeholder the renderer never fills reaches the kernel verbatim');
  assert.ok(placeholders.includes('{ownerLanguage}'));
});
