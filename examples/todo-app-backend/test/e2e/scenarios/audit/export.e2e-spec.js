'use strict';

/**
 * fr.audit.export - proven through the public GraphQL door only.
 * Check command: npm run test:e2e -- audit/export
 *
 * Not run, by the registry: ac.audit.append-only.chain-detects-tamper (the only criterion nested under
 * the one rule this record composes), which requires mutating stored lines out of band and reading a
 * chain break index back - neither of which any public operation offers.
 */

const { call, persona } = require('../../lib/client');
const { scenario, assertImplemented } = require('../../lib/scenario');
const { uniqueTitle, createTask, exportLines, sleep, erase } = require('../../lib/fixtures');

const GROUP = 'audit/export';

scenario(GROUP, 'fr.audit.export.main-1', async () => {
  const created = await createTask('owner', uniqueTitle('export-read'));
  await sleep(1200);
  const lines = await exportLines('owner');
  const mine = lines.filter((line) => line.target === created.taskId);
  expect(mine.length).toBeGreaterThan(0);
  expect(mine.some((line) => line.action === 'task.created')).toBe(true);
  for (const line of mine) {
    expect(typeof line.action).toBe('string');
    expect(line.action).not.toMatch(/[A-Za-z0-9+/]{12,}={0,2}\.[A-Za-z0-9+/]{8,}/);
    expect(new Date(line.at).getTime()).not.toBeNaN();
  }
});

scenario(GROUP, 'fr.audit.export.post-1', async () => {
  const theirs = await createTask('other', uniqueTitle('export-not-mine'));
  const mine = await exportLines('owner');
  const targets = mine.map((line) => line.target).filter(Boolean);
  expect(targets).not.toContain(theirs.taskId);
  const theirOwn = await exportLines('other');
  expect(theirOwn.map((line) => line.target)).toContain(theirs.taskId);
});

scenario(GROUP, 'fr.audit.export.exception-1', async () => {
  const created = await createTask('other', uniqueTitle('export-erased'));
  const session = await persona('other');
  await sleep(1200);
  const before = await call('exportMyData', { token: session.token, note: 'exportMyData before the erasure completes' });
  expect(before.data.exportMyData.map((line) => line.target)).toContain(created.taskId);

  await erase('other');

  const after = await call('exportMyData', { token: session.token, note: 'exportMyData once this person\'s key has been destroyed' });
  expect(after.errors).toBeNull();
  expect(after.data.exportMyData).toEqual([]);

  const ownerStillSeesOwn = await exportLines('owner');
  expect(ownerStillSeesOwn.length).toBeGreaterThan(0);
});

assertImplemented(GROUP);
