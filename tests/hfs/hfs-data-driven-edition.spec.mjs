import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkRepo } from '../../scripts/hfs/check.mjs';
import { loadRuleCatalog, loadSlotManifest } from '../../scripts/hfs/slots.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const declaration = (edition) => ({
  hfs: 2,
  kind: 'app',
  project: 'demo',
  ...(edition === undefined ? {} : { edition }),
  sides: {
    be: { apps: [{ name: 'core', kind: 'api' }] },
    fe: { apps: [{ name: 'web', kind: 'next' }] },
  },
});
const temporaryDirectory = (t, prefix) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
};

test('a new lite-forbidden slot produces HFS_FORBIDDEN_PRESENT without an edition-rule code change', (t) => {
  const original = fs.readFileSync(path.join(root, 'knowledge/hfs/slots.yaml'), 'utf8');
  const addition = [
    '  - id: be.future-only',
    '    profiles: [be]',
    '    path: "future-only/"',
    '    presence: optional',
    '    litePresence: forbidden',
    '    tracked: tracked',
    '    tier: none',
    '    tests: none',
    '    coverage: none',
    '    goesTo: "the full edition"',
    '    since: 2.1.0',
    '',
  ].join('\n');
  const anchor = '# Checks that read this manifest (all ship from .claude; none keeps its own path list)';
  const text = original.replace(anchor, `${addition}${anchor}`);
  assert.notEqual(text, original, 'the copied manifest received the probe slot');
  const manifest = loadSlotManifest({ text });
  const repoRoot = temporaryDirectory(t, 'hfs-data-edition-slot-');
  const file = 'be/future-only/probe.ts';

  const lite = checkRepo({ repoRoot, declaration: declaration('lite'), files: [file], tree: false, manifest });
  assert.ok(
    lite.findings.some((finding) => finding.code === 'HFS_FORBIDDEN_PRESENT' && finding.path === file),
    JSON.stringify(lite.findings.filter((finding) => finding.path === file)),
  );
  const full = checkRepo({ repoRoot, declaration: declaration(), files: [file], tree: false, manifest });
  assert.equal(full.findings.some((finding) => finding.code === 'HFS_FORBIDDEN_PRESENT' && finding.path === file), false);
});

test('a copied rules catalog marked full-only drives the central findings filter in lite and full', (t) => {
  const original = fs.readFileSync(path.join(root, 'knowledge/hfs/rules.yaml'), 'utf8');
  const text = original.replace(
    /(  - id: R01\r?\n    code: "HFS_SLOT_UNDECLARED"\r?\n)/,
    '$1    editions: [full]\n',
  );
  assert.notEqual(text, original, 'the copied catalog marked R01 full-only');
  const manifest = loadSlotManifest();
  const catalog = loadRuleCatalog({ text, manifest });
  assert.equal(catalog.judgedIn('HFS_SLOT_UNDECLARED', 'lite'), false);
  assert.equal(catalog.judgedIn('HFS_SLOT_UNDECLARED', 'full'), true);

  const catalogRoot = temporaryDirectory(t, 'hfs-data-edition-rules-');
  fs.mkdirSync(path.join(catalogRoot, 'knowledge/hfs'), { recursive: true });
  fs.mkdirSync(path.join(catalogRoot, 'modules/kernel'), { recursive: true });
  fs.writeFileSync(path.join(catalogRoot, 'knowledge/hfs/rules.yaml'), text);
  fs.copyFileSync(path.join(root, 'knowledge/hfs/canon-pins.yaml'), path.join(catalogRoot, 'knowledge/hfs/canon-pins.yaml'));
  fs.copyFileSync(path.join(root, 'modules/kernel/failure-codes.yaml'), path.join(catalogRoot, 'modules/kernel/failure-codes.yaml'));

  const repoRoot = temporaryDirectory(t, 'hfs-data-edition-app-');
  const probe = { code: 'HFS_SLOT_UNDECLARED', level: 'error', path: 'probe.ts', message: 'catalog filter probe', probe: true };
  const options = { repoRoot, root: catalogRoot, files: [], tree: false, manifest, extraFindings: [probe] };
  const lite = checkRepo({ ...options, declaration: declaration('lite') });
  const full = checkRepo({ ...options, declaration: declaration() });
  assert.equal(lite.findings.some((finding) => finding.probe), false, 'lite drops the full-only rule finding');
  assert.equal(full.findings.some((finding) => finding.probe), true, 'full keeps the same rule finding');
});
