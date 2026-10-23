// proves: HFS_PEER_INTEGRATION_MISSING@lite
// proves: HFS_PEER_INTEGRATION_MISSING@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { peerIntegrationFindings } from '../runtime/scripts/hfs/rules/peer-integrations.mjs';

const APOLLO_EXPRESS5 = {
  '@nestjs/apollo': '^13.4.5',
  '@nestjs/platform-express': '11.2.5',
};
const PEER = '@as-integrations/express5';

function check(t, edition, dependencies, devDependencies = {}) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-peer-coverage-'));
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  fs.writeFileSync(path.join(repoRoot, 'package.json'), JSON.stringify({ dependencies, devDependencies }));
  return peerIntegrationFindings({ repoRoot, files: ['package.json'], repo: { edition } });
}

for (const edition of ['lite', 'full']) {
  test(`HFS_PEER_INTEGRATION_MISSING (${edition}): a missing runtime integration peer is refused`, (t) => {
    const findings = check(t, edition, APOLLO_EXPRESS5);
    assert.deepEqual(findings.map(({ code, path: file, pair, requires }) => [code, file, pair, requires]), [
      ['HFS_PEER_INTEGRATION_MISSING', 'package.json', 'nestjs-apollo-express5', PEER],
    ]);
  });

  test(`HFS_PEER_INTEGRATION_MISSING (${edition}): a devDependency peer is refused for production`, (t) => {
    const findings = check(t, edition, APOLLO_EXPRESS5, { [PEER]: '^1.1.2' });
    assert.deepEqual(findings.map(({ code }) => code), ['HFS_PEER_INTEGRATION_MISSING']);
    assert.match(findings[0].message, /only a devDependency/);
  });

  test(`HFS_PEER_INTEGRATION_MISSING (${edition}): the required runtime peer passes`, (t) => {
    assert.deepEqual(check(t, edition, { ...APOLLO_EXPRESS5, [PEER]: '^1.1.2' }), []);
  });

  test(`HFS_PEER_INTEGRATION_MISSING (${edition}): an unmatched integration pair passes`, (t) => {
    assert.deepEqual(check(t, edition, { '@nestjs/apollo': '^12.0.0', '@nestjs/platform-express': '^10.4.0' }), []);
    assert.deepEqual(check(t, edition, { '@nestjs/platform-express': '11.2.5' }), []);
  });
}
