import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from '../helpers/hfs-arch-fixture.mjs';

// R24 arch-config-unread (HFS_ARCH_CONFIG_UNREAD): hfs.json is the one declaration the machine reads. A config file it no
// longer reads (architecture.json) is a finding, and so is a declaration that leaves the machine with no file to analyse.
const hits = report => findings(report, 'HFS_ARCH_CONFIG_UNREAD');

test('a repository with only hfs.json and analysed source raises no HFS_ARCH_CONFIG_UNREAD', t => {
  const report = runArch(archFixture(t));
  assert.deepEqual(hits(report), []);
  assert.equal(report.coverage.configUnread.status, 'checked');
  assert.equal(report.coverage.configUnread.retired, 0);
  assert.ok(report.coverage.configUnread.analysed > 0);
  assert.ok(report.coverage.checkedRuleIds.includes('HFS_ARCH_CONFIG_UNREAD'));
});

test('a tracked architecture.json, at the root or in an app, is HFS_ARCH_CONFIG_UNREAD at its own path', t => {
  const report = runArch(archFixture(t, { files: { 'architecture.json': '{}\n', 'apps/core/architecture.json': '{}\n' } }));
  assert.deepEqual(hits(report).map(item => item.path).sort(), ['apps/core/architecture.json', 'architecture.json']);
  assert.match(hits(report)[0].message, /no longer reads/);
});

test('a front-end repository with an architecture.json is refused the same way', t => {
  const report = runArch(archFixture(t, { profile: 'fe', files: { 'architecture.json': '{}\n', 'apps/web/src/modules/config/index.ts': 'export const config = 1;\n' } }));
  assert.deepEqual(hits(report).map(item => item.path), ['architecture.json']);
});

test('a declaration with no analysed production source is HFS_ARCH_CONFIG_UNREAD at hfs.json', t => {
  const report = runArch(archFixture(t, { files: { 'apps/core/src/main.ts': null, 'apps/core/src/app.module.ts': null } }));
  assert.deepEqual(hits(report).map(item => item.path), ['hfs.json']);
  assert.equal(report.coverage.configUnread.analysed, 0);
});
