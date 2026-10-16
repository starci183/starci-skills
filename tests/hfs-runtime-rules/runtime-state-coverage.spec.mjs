// proves: RT_CITED_PATH_MISSING@lite
// proves: RT_CITED_PATH_MISSING@full
// proves: RT_PINNED_PATH_MOVED@lite
// proves: RT_PINNED_PATH_MOVED@full
// proves: RT_NODE_MODULES_LINK@lite
// proves: RT_NODE_MODULES_LINK@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { citedPathFindings } from '../../scripts/checks/check-contract-cites.mjs';
import { pinnedFindings } from '../../scripts/hfs/runtime-rules/pinned.mjs';
import { nodeModulesLinkFindings } from '../../scripts/hfs/runtime-rules/node-modules-link.mjs';
import { parseSource } from '../../scripts/hfs/runtime-rules/source-ast.mjs';

function citationFixture(t, edition, citedFile) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `starci-cited-${edition}-`));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'guide.md'), `Read \`scripts/${citedFile}.mjs\`.\n`);
  fs.writeFileSync(path.join(root, 'scripts', 'present.mjs'), 'export const present = true;\n');
  return root;
}

function pinnedContext(files) {
  return {
    params: { pinned: [{ path: 'scripts/entry.mjs', why: 'the external launcher invokes this entry' }] },
    files,
    fileSet: new Set(files),
  };
}

function linkContext(text) {
  const file = 'scripts/worker/stage.mjs';
  const source = parseSource(text, file);
  return { sources: [{ path: file, text }], parsed: () => source };
}

for (const edition of ['lite', 'full']) {
  test(`${edition} rejects a missing runtime path cited by live prose`, (t) => {
    assert.deepEqual(citedPathFindings(citationFixture(t, edition, 'missing')).map((finding) => finding.code), ['RT_CITED_PATH_MISSING']);
  });

  test(`${edition} accepts live prose whose cited runtime path exists`, (t) => {
    assert.deepEqual(citedPathFindings(citationFixture(t, edition, 'present')), []);
  });

  test(`${edition} rejects a missing path pinned by an external launcher`, () => {
    assert.deepEqual(pinnedFindings(pinnedContext(['scripts/replacement.mjs'])).map((finding) => finding.code), ['RT_PINNED_PATH_MOVED']);
  });

  test(`${edition} accepts the tracked path pinned by an external launcher`, () => {
    assert.deepEqual(pinnedFindings(pinnedContext(['scripts/entry.mjs'])), []);
  });

  test(`${edition} rejects runtime source that links node_modules`, () => {
    const text = "import fs from 'node:fs';\nexport const stage = (target) => fs.symlinkSync(target, 'node_modules', 'junction');\n";
    assert.deepEqual(nodeModulesLinkFindings(linkContext(text)).map((finding) => finding.code), ['RT_NODE_MODULES_LINK']);
  });

  test(`${edition} accepts runtime source that only detects node_modules links`, () => {
    const text = "import fs from 'node:fs';\nexport const linked = () => fs.lstatSync('node_modules').isSymbolicLink();\n";
    assert.deepEqual(nodeModulesLinkFindings(linkContext(text)), []);
  });
}
