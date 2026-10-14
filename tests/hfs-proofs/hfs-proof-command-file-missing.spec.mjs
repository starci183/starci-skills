// proves: HFS_PROOF_COMMAND_FILE_MISSING@lite
// proves: HFS_PROOF_COMMAND_FILE_MISSING@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkRepo } from '../../scripts/hfs/check.mjs';
import { loadWorkSchemaValidators } from '../../scripts/work/validate/check-work-schemas.mjs';

const { validate } = loadWorkSchemaValidators().validators.get('work/ui-screen@1');

for (const edition of ['lite', 'full']) {
  test(`HFS_PROOF_COMMAND_FILE_MISSING (${edition}): an admitted proof plan must name an existing file`, (t) => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-proof-command-'));
    t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
    const declaration = {
      hfs: 3, kind: 'app', project: 'demo', edition,
      sides: { be: { apps: [{ name: 'api', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } },
    };
    // Brand drawings remain real Work records in lite; stale full implementation records would be skipped before R105.
    const record = '.starciwork/brand/drawings/logo/index.yaml';
    const target = 'scripts/render-logo.mjs';
    const drawing = {
      schema: 'work/ui-screen@1', id: 'ui.brand.logo', title: 'Brand wordmark preview', state: 'todo',
      brand: { rev: 1 }, refs: ['ui.brand.reference'],
      ui: {
        intent: 'Preview the product wordmark before rendering assets.',
        surfaces: [{ name: 'wordmark', route: '/brand', purpose: 'Review the wordmark', actors: ['owner'] }],
        states: [{ name: 'ready', trigger: 'The preview loads', behavior: 'The wordmark is visible.' }],
        coverage: { scale: 'bounded', representativeScreens: ['wordmark'], map: [{ screen: 'wordmark', state: 'ready', viewport: 'desktop' }] },
        accessibility: ['The wordmark has an accessible name.'],
        responsive: ['Keep the mark legible at narrow widths.'], observations: ['The preview is planned.'], gaps: [],
      },
      requiresProof: { measurement: { required: true, command: `node ${target}` } },
    };
    assert.equal(validate(drawing), true, JSON.stringify(validate.errors));
    fs.mkdirSync(path.dirname(path.join(repoRoot, record)), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, record), JSON.stringify(drawing));
    const files = [record];
    const findings = () => checkRepo({ repoRoot, declaration, files, tree: false }).findings
      .filter((finding) => finding.code === 'HFS_PROOF_COMMAND_FILE_MISSING');
    const missing = findings();
    assert.deepEqual(missing.map(({ code, level, path: file, kind, missing: absent }) => ({ code, level, file, kind, absent })), [{
      code: 'HFS_PROOF_COMMAND_FILE_MISSING', level: 'error', file: record, kind: 'measurement', absent: target,
    }]);
    assert.match(missing[0].message, /repository does not hold/);

    fs.mkdirSync(path.dirname(path.join(repoRoot, target)), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, target), 'export {};\n');
    assert.deepEqual(findings(), [], 'an existing file makes the exact same proof command runnable');
  });
}
