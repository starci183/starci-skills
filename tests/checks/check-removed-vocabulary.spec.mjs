import test from 'node:test';
import assert from 'node:assert/strict';
import { removedVocabularyFindings, checkRemovedVocabulary, CODE, MARKER } from '../../scripts/checks/check-removed-vocabulary.mjs';
import { removedVocabulary, removedOfKind, removedNotice, removedKinds } from '../../engine/removed-vocabulary.mjs';
import { refuseRemovedKeys } from '../../engine/model-config.mjs';
import { normalizeOwnerRoutingBias } from '../../scripts/lib/owner-routing-bias.mjs';

const SKILL = 'skills/starci/references/define-goal.md';
const taught = 'an explicit requirement such as "must use Claude" becomes `require:{provider:claude}`.'; // [removed-list]

test('the shipped tree spells no removed name outside the list, the changelog and marked blocks', () => {
  assert.deepEqual(checkRemovedVocabulary().map((finding) => finding.message), []);
});

test('a removed spelling planted in a skill file is an RT_REMOVED_VOCABULARY finding naming file, line, name and replacement', () => {
  const findings = removedVocabularyFindings({ [SKILL]: `first line\n${taught}\n` });
  assert.equal(findings.length, 1);
  assert.deepEqual([findings[0].code, findings[0].path, findings[0].line, findings[0].name], [CODE, SKILL, 2, 'require']);
  assert.match(findings[0].message, new RegExp(`${SKILL}:2 .*require.*1\.0\.0-alpha\.6.*only`));
});

test('RT_REMOVED_VOCABULARY accepts the same spelling on a marked line, or under a bare marker until the blank line', () => {
  const inline = `${taught} <!-- ${MARKER} -->\n`;
  const block = `<!-- ${MARKER} -->\n${taught}\nsecond line: models.pools\n\n${taught}\n`; // [removed-list]
  assert.deepEqual(removedVocabularyFindings({ [SKILL]: inline }), []);
  assert.deepEqual(removedVocabularyFindings({ [SKILL]: block }).map((finding) => finding.line), [5]);
});

test('the changelog, the list file and files outside the instruction surfaces are never scanned', () => {
  const files = { 'CHANGELOG.md': taught, 'modules/kernel/removed-vocabulary.yaml': taught, 'packages/x/README.md': taught };
  assert.deepEqual(removedVocabularyFindings(files), []);
  assert.equal(removedVocabularyFindings({ 'docs/a.md': taught, 'modules/a/b.yaml': taught, 'knowledge/a.md': taught, 'README.md': taught }).length, 4);
});

test('a config key, a flag, a verb and a code are found by their literal; a longer word is not', () => {
  const text = 'set models.pools\nrun starci debug pass now\nuse --caller-model x\nerror workflow-debug-not-ready\nmodels.poolsize is unrelated\n'; // [removed-list]
  assert.deepEqual(removedVocabularyFindings({ 'docs/a.md': text }).map((finding) => [finding.line, finding.name]),
    [[1, 'models.pools'], [2, 'starci debug pass'], [3, '--caller-model'], [4, 'workflow-debug-not-ready']]); // [removed-list]
});

test('every entry declares its kind, replacement and release, and each config-key entry is refused by name with that replacement', () => {
  for (const entry of removedVocabulary()) {
    assert.ok(removedKinds().includes(entry.kind), entry.id);
    assert.ok(entry.name && entry.use && entry.since, entry.id);
  }
  assert.equal(new Set(removedVocabulary().map((entry) => entry.id)).size, removedVocabulary().length);
  for (const { name, use } of removedOfKind('config-key')) {
    const config = {};
    let node = config;
    const parts = name.split('.');
    parts.slice(0, -1).forEach((part) => { node = node[part] = {}; });
    node[parts.at(-1)] = 1;
    assert.throws(() => refuseRemovedKeys(config), (error) => error.message.includes(`${name} is removed (${use})`), name);
  }
});

test('a goal bias holding require is refused with the replacement and the member forms only accepts', () => {
  assert.throws(() => normalizeOwnerRoutingBias({ require: { provider: 'claude' } }), (error) => {
    assert.equal(error.code, 'invalid-owner-routing-bias');
    assert.equal(error.message, `Invalid owner routing bias: bias has unknown fields: require; ${removedNotice('bias-field', 'require')}`);
    assert.match(error.message, /require is removed \(a requirement is now `only`.*"<agent>", "<agent>\/<model>" or a \{pool, provider, model\} selector/);
    return true;
  });
  assert.deepEqual(normalizeOwnerRoutingBias({ only: ['claude'] }).only, ['claude-agent']);
  assert.throws(() => normalizeOwnerRoutingBias({ nonsense: 1 }), (error) => !error.message.includes('is removed'));
});

test('RT_REMOVED_VOCABULARY: a spec spells a removed name only where it asserts the refusal', () => {
  const stale = "test('routes a goal', () => {\n  launch({ bias: { require: { provider: 'codex' } } });\n});\n"; // [removed-list]
  const refusing = "test('a goal bias with the removed field is refused', () => {\n  launch({ bias: { require: { provider: 'codex' } } });\n});\n"; // [removed-list]
  const throwing = "assert.throws(() => validate({ coreDebug: 1 }));\n"; // [removed-list]
  assert.deepEqual(removedVocabularyFindings({ 'tests/a/b.spec.mjs': stale }).map((finding) => [finding.line, finding.name]), [[2, 'require']]);
  assert.deepEqual(removedVocabularyFindings({ 'tests/a/b.spec.mjs': refusing }), []);
  assert.deepEqual(removedVocabularyFindings({ 'tests/a/b.spec.mjs': throwing }), []);
});
