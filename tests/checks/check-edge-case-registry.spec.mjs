import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkEdgeCaseRegistry, REGISTRY_FILE, CODE } from '../../scripts/checks/check-edge-case-registry.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';

const treeWith = (t, yamlText, files = []) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-edge-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.dirname(path.join(root, REGISTRY_FILE)), { recursive: true });
  fs.writeFileSync(path.join(root, REGISTRY_FILE), yamlText);
  fs.mkdirSync(path.join(root, 'modules/kernel'), { recursive: true });
  fs.copyFileSync(path.join(skillRoot, 'modules/kernel/roles.yaml'), path.join(root, 'modules/kernel/roles.yaml'));
  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), 'rule text anchor\n');
  }
  return root;
};

const doc = (cases) => `families: [failure-while-running]\ncases:\n${cases}`;
const covered = `  - id: a
    family: failure-while-running
    met: {date: "2026-10-08", where: w, evidence: e}
    rule: {file: scripts/x.mjs, anchor: "anchor"}
    spec: tests/x.spec.mjs
    status: covered
`;

test('the shipped registry names an existing rule and spec for every covered case', () => {
  assert.deepEqual(checkEdgeCaseRegistry(skillRoot).map((f) => f.message), []);
});

test('a covered case whose spec or rule is missing is a finding', (t) => {
  const findings = checkEdgeCaseRegistry(treeWith(t, doc(covered), ['scripts/x.mjs']));
  assert.deepEqual(findings.map((f) => f.code), [CODE]);
  assert.equal(CODE, 'RT_EDGE_CASE_REGISTRY');
  assert.match(findings[0].message, /a: spec file tests\/x\.spec\.mjs does not exist/);
  assert.equal(checkEdgeCaseRegistry(treeWith(t, doc(covered), ['tests/x.spec.mjs'])).length, 1);
  assert.deepEqual(checkEdgeCaseRegistry(treeWith(t, doc(covered), ['scripts/x.mjs', 'tests/x.spec.mjs'])), []);
});

test('an anchor the rule file lacks, an unlisted family, an open case without a why and a duplicate id are findings', (t) => {
  const text = doc(`${covered.replace('anchor: "anchor"', 'anchor: "absent"')}  - id: a
    family: other
    met: {date: "2026-10-08", where: w, evidence: e}
    status: open
`);
  const messages = checkEdgeCaseRegistry(treeWith(t, text, ['scripts/x.mjs', 'tests/x.spec.mjs'])).map((f) => f.message).join('\n');
  assert.match(messages, /lacks the anchor absent/);
  assert.match(messages, /family other is not listed/);
  assert.match(messages, /is open and says no why/);
  assert.match(messages, /a: is listed twice/);
});

test('a finding names a known role, a duty, evidence and a remedy state, and a correct error is no finding', (t) => {
  const withFinding = (finding) => doc(`${covered.replace('status: covered', `finding: ${finding}\n    status: open\n    why: x`).replace(/    rule:.*\n    spec:.*\n/, '')}`);
  const good = '{role: kernel, duty: never, verdict: departs, evidence: e, remedy: {state: open}}';
  assert.deepEqual(checkEdgeCaseRegistry(treeWith(t, withFinding(good))), []);
  const bad = '{role: nobody, duty: mood, verdict: correct-error, evidence: "", remedy: {state: done}}';
  const messages = checkEdgeCaseRegistry(treeWith(t, withFinding(bad))).map((f) => f.message).join('\n');
  for (const part of [/role nobody is not a role/, /duty mood is not a field/, /a correct error is no finding/, /names no evidence/, /remedy state must be/]) assert.match(messages, part);
});

test('a case found on a live host and covered names a replay spec of tests/replay/ that uses the replay harness', (t) => {
  const live = (extra = '') => doc(`${covered.replace('status: covered', `found: live\n${extra}    status: covered`)}`);
  const files = ['scripts/x.mjs', 'tests/x.spec.mjs'];
  assert.match(checkEdgeCaseRegistry(treeWith(t, live(), files)).map((f) => f.message).join('\n'), /found live and is covered but names no replay spec/);
  const wrongDir = checkEdgeCaseRegistry(treeWith(t, live('    replay: tests/x.spec.mjs\n'), files)).map((f) => f.message).join('\n');
  assert.match(wrongDir, /replay tests\/x\.spec\.mjs is not a spec of tests\/replay\//);
  assert.match(checkEdgeCaseRegistry(treeWith(t, live('    replay: tests/replay/y.spec.mjs\n'), files)).map((f) => f.message).join('\n'), /replay spec tests\/replay\/y\.spec\.mjs does not exist/);
  assert.match(checkEdgeCaseRegistry(treeWith(t, live('    replay: tests/replay/y.spec.mjs\n'), [...files, 'tests/replay/y.spec.mjs'])).map((f) => f.message).join('\n'), /does not use the replay harness/);
  const root = treeWith(t, live('    replay: tests/replay/y.spec.mjs\n'), files);
  fs.mkdirSync(path.join(root, 'tests/replay'), { recursive: true });
  fs.writeFileSync(path.join(root, 'tests/replay/y.spec.mjs'), "import { replayWorld } from '../_replay/world.mjs';\n");
  assert.deepEqual(checkEdgeCaseRegistry(root), []);
  assert.match(checkEdgeCaseRegistry(treeWith(t, doc(covered.replace('status: covered', 'found: seen\n    status: covered')), files)).map((f) => f.message).join('\n'), /found must be live/);
  const open = doc(`${covered.replace(/    rule:.*\n    spec:.*\n/, '').replace('status: covered', 'found: live\n    status: open\n    why: not yet')}`);
  assert.deepEqual(checkEdgeCaseRegistry(treeWith(t, open)), [], 'an open case found live may still lack its replay');
});
