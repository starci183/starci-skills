import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { versionPinFindings, pinsOf, isBindingLeaf, checkVersionPinOnce, CODE } from '../../scripts/checks/check-version-pin-once.mjs';

const pins = pinsOf({ pins: { '@starci/grammar': { version: '0.8.2' }, '@starci/hfs': { version: '4.0.9' }, 'next-intl': { version: '4.13.6' }, eslint: { version: '9.39.5' } } });
const paths = (findings) => findings.map((f) => f.path);

test('a pinned version restated in prose near the package name is RT_VERSION_RESTATED', () => {
  const findings = versionPinFindings({
    'knowledge/x/doc.yaml': 'notes: |\n  Snapshot from @starci/grammar@0.8.2 source.\n',
    'docs/why.md': 'the decision was made against next-intl 4.13.6 because requestLocale went away',
  }, pins);
  assert.deepEqual(paths(findings), ['knowledge/x/doc.yaml:2', 'docs/why.md:1']);
  assert.ok(findings.every((f) => f.code === CODE));
});

test('a version of the package that is not the pin is a fact, not a restatement', () => {
  const findings = versionPinFindings({
    'knowledge/x/doc.yaml': 'notes: |\n  re-verified against @starci/grammar@0.5.1 source and again on 0.6.0.\n',
  }, pins);
  assert.deepEqual(findings, []);
});

test('the declared binding keys the refreshers write are exempt', () => {
  const files = {
    'modules/models/code-patterns.yaml': 'profiles:\n  nest:\n    canon:\n      package: \'@starci/grammar\'\n      version: 0.8.2\n',
    'knowledge/grammars/x/index.yaml': 'provenance:\n  package: "@starci/grammar"\n  version: "0.8.2"\n',
    'knowledge/grammars/x/DNA.yaml': 'identity:\n  package: "@starci/grammar"\n  version: "0.8.2"\n',
  };
  assert.deepEqual(versionPinFindings(files, pins), []);
  assert.equal(isBindingLeaf(['canon:', '  version: 0.8.2'], 1), true);
  assert.equal(isBindingLeaf(['meta:', '  version: 0.8.2'], 1), false);
});

test('a version leaf under a non-binding parent still restates the pin', () => {
  const findings = versionPinFindings({
    'knowledge/x/doc.yaml': 'meta:\n  package: "@starci/grammar"\n  version: "0.8.2"\n',
  }, pins);
  assert.deepEqual(paths(findings), ['knowledge/x/doc.yaml:3']);
});

test('package.json, canon-pins, lockfiles, tests and generated runtime are outside the law', () => {
  const findings = versionPinFindings({
    'package.json': '"@starci/grammar": "0.8.2"',
    'examples/app/package.json': '"eslint": "9.39.5"',
    'package-lock.json': '"@starci/hfs": { "version": "4.0.9" }',
    'knowledge/hfs/canon-pins.yaml': "'@starci/grammar':\n  version: 0.8.2",
    'packages/hfs/runtime/knowledge/hfs/canon-pins.yaml': "'@starci/grammar':\n  version: 0.8.2",
    'tests/x.spec.mjs': "'@starci/grammar@0.8.2'",
    'CHANGELOG.md': '## @starci/hfs 4.0.9',
  }, pins);
  assert.deepEqual(findings, []);
});

test('this runtime keeps every pinned version spelled once', () => {
  assert.deepEqual(checkVersionPinOnce(path.resolve(import.meta.dirname, '..', '..')), []);
});
