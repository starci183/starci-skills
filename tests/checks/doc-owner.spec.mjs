import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DOC_OWNER_MISSING, checkDocOwnerMain, docFiles, docOwnerFindings } from '../../scripts/checks/check-doc-owner.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const CHECK = path.join(repoRoot, 'scripts/checks/check-doc-owner.mjs');

const fixtureTree = (files) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-doc-owner-'));
  for (const [rel, body] of Object.entries(files)) {
    const target = path.join(root, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);
  }
  return root;
};

const OWNED = (owner, title, body = '') => `Owner: ${owner}\n# ${title}\n\n${body}`;

test('the real tree: every tracked docs/*.md carries exactly one ownership header, tasks are unique and no pair retells one story', () => {
  const docs = docFiles(repoRoot);
  assert.ok(docs.length > 10, 'the runtime ships real documentation');
  const findings = docOwnerFindings(repoRoot);
  assert.deepEqual(findings.map((f) => f.path), [], JSON.stringify(findings.slice(0, 10), null, 2));
  const run = spawnSync(process.execPath, [CHECK], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout + run.stderr);
});

test('RT_DOC_NO_OWNER: a missing header, a second header, a bad owner root and a dead owner path are each refused', () => {
  const root = fixtureTree({
    'docs/no-header.md': '# A document\n\nNo ownership line at all.\n',
    'docs/two-headers.md': 'Owner: knowledge/hfs/rules.yaml\n# Two\n\nTask: also this one.\nOwner: modules/y.yaml\n',
    'modules/y.yaml': 'y: 1\n',
    'docs/bad-root.md': 'Owner: engine/x.mjs\n# Bad root\n\nThe engine is not knowledge or modules.\n',
    'docs/dead-owner.md': 'Owner: knowledge/no-such-file.yaml\n# Dead owner\n\nNothing there.\n',
    'docs/good.md': OWNED('knowledge/hfs/rules.yaml', 'Rules', 'Explains the catalog.'),
    'docs/task.md': 'Task: install a host\n# Install\n\nHow to install.\n',
    'knowledge/hfs/rules.yaml': 'rules: []\n',
  });
  try {
    const findings = docOwnerFindings(root);
    assert.ok(findings.every((f) => f.code === DOC_OWNER_MISSING));
    assert.deepEqual(findings.map((f) => f.path).sort(),
      ['docs/bad-root.md', 'docs/dead-owner.md', 'docs/no-header.md', 'docs/two-headers.md']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('RT_DOC_NO_OWNER: two documents may not carry the same task, and a task line ignores case and spacing', () => {
  const root = fixtureTree({
    'docs/install-a.md': 'Task: install a host\n# Install A\n\nFirst how-to.\n',
    'docs/install-b.md': 'Task:  Install   a HOST \n# Install B\n\nSecond how-to.\n',
  });
  try {
    const findings = docOwnerFindings(root);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].code, DOC_OWNER_MISSING);
    assert.equal(findings[0].other, 'docs/install-a.md');
    assert.ok(findings[0].message.includes('docs/install-b.md'), findings[0].message);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('RT_DOC_NO_OWNER: two documents sharing two title topic words and 30% of the shorter document\'s sentences are one document', () => {
  const shared = [
    'The gate runs the lint slice over the changed files.',
    'A red gate refuses the op settle.',
    'Findings already at the base are preexisting.',
    'A tool that could not run is never a pass.',
  ].join(' ');
  const root = fixtureTree({
    'knowledge/x.yaml': 'a: 1\n',
    'docs/gate-flow.md': OWNED('knowledge/x.yaml', 'Gate flow', `${shared} One extra sentence only here.`),
    'docs/gate-flow-details.md': OWNED('knowledge/x.yaml', 'Gate flow details', `${shared} An entirely different long explanation follows. It keeps going and going. Nothing shared remains.`),
    // Same sentences but only one shared topic word: allowed.
    'docs/other-flow.md': OWNED('knowledge/x.yaml', 'Unrelated name', shared),
  });
  try {
    const findings = docOwnerFindings(root);
    assert.deepEqual(findings.map((f) => [f.path, f.other]), [['docs/gate-flow-details.md', 'docs/gate-flow.md']]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('passing tree: an Owner document, a Task document and distinct titles are clean', () => {
  const root = fixtureTree({
    'knowledge/source.yaml': 'a: 1\n',
    'modules/owned.yaml': 'b: 2\n',
    'docs/owned.md': OWNED('knowledge/source.yaml', 'One thing', 'Explains the source.'),
    'docs/owned-dir.md': OWNED('modules/', 'A directory owner', 'Explains the contract tree.'),
    'docs/how-to.md': 'Task: do the thing\n# Do the thing\n\nSteps for the task.\n',
  });
  try {
    assert.deepEqual(docOwnerFindings(root), []);
    const run = spawnSync(process.execPath, [CHECK, '--root', root], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stdout + run.stderr);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('CLI: a violating tree exits 1 with the finding, --json reports, a bad argument is 2', () => {
  const dirty = fixtureTree({ 'docs/a.md': '# Nothing\n\nNo header.\n' });
  try {
    const red = checkDocOwnerMain(['--root', dirty]);
    assert.equal(red.exitCode, 1);
    assert.ok(red.text.includes('docs/a.md') && red.text.includes(DOC_OWNER_MISSING));
    const json = JSON.parse(checkDocOwnerMain(['--root', dirty, '--json']).text);
    assert.equal(json.schema, 'starci/doc-owner@1');
    assert.equal(json.ok, false);
    assert.equal(checkDocOwnerMain(['--bogus']).exitCode, 2);
    assert.equal(checkDocOwnerMain(['--root']).exitCode, 2);
    assert.equal(checkDocOwnerMain(['--help']).exitCode, 0);
  } finally {
    fs.rmSync(dirty, { recursive: true, force: true });
  }
});
