// proves: HFS_ARCH_CONFIG_UNREAD@lite
// proves: HFS_ARCH_CONFIG_UNREAD@full
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkConfigUnread } from '../runtime/scripts/hfs/architecture/config-unread.mjs';

for (const edition of ['lite', 'full']) {
  test(`${edition} invalid: a loaded declaration with no analysed source is refused`, () => {
    const report = checkConfigUnread({ context: { files: [] } });
    assert.deepEqual(report.violations.map(item => item.ruleId), ['HFS_ARCH_CONFIG_UNREAD']);
    assert.equal(report.violations[0].path, 'hfs.json');
    assert.deepEqual(report.coverage, { status: 'checked', analysed: 0 });
  });

  test(`${edition} valid: an analysed production source passes`, () => {
    const report = checkConfigUnread({ context: { files: [{ path: 'apps/core/src/main.ts' }] } });
    assert.deepEqual(report.violations, []);
    assert.equal(report.violations.some(item => item.ruleId === 'HFS_ARCH_CONFIG_UNREAD'), false);
    assert.deepEqual(report.coverage, { status: 'checked', analysed: 1 });
  });
}
