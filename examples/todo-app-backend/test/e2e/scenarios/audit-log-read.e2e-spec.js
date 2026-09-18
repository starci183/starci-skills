'use strict';

/**
 * fr.audit.log.read - proven through the public GraphQL door only.
 * Check command: npm run test:e2e -- audit/log-read
 *
 * This record is already `state: todo`, blocked by gap.audit.operator-role ("The example has no
 * operator/admin role today"), and the run confirms that from the client side: the door the record
 * describes is not there for a caller to send a request to. Two of its assertions are therefore not-run
 * (see lib/registry.js) and the coverage guard fails this group loudly rather than passing it quietly.
 */

const { call, persona } = require('../lib/client');
const { scenario, assertImplemented } = require('../lib/scenario');
const { uniqueTitle, createTask, sleep, erase } = require('../lib/fixtures');

const GROUP = 'audit/log-read';
/** The seal format is `iv.tag.ciphertext`, three base64 parts - the thing the postcondition forbids. */
const SEALED_BLOB = /[A-Za-z0-9+/]{12,}={0,2}\.[A-Za-z0-9+/]{8,}={0,2}\.[A-Za-z0-9+/]{8,}={0,2}/;

scenario(GROUP, 'fr.audit.log.read.exception-1', async () => {
  const anonymous = await call('auditLog', { note: 'auditLog with no Authorization header at all' });
  expect(anonymous.errorCode).toBe('SESSION_NOT_FOUND');
  expect(anonymous.data).toBeNull();

  const malformed = await call('auditLog', { token: 'not-a-session-this-run-issued', note: 'auditLog with a token this run never issued' });
  expect(malformed.errorCode).toBe('SESSION_NOT_FOUND');
  expect(malformed.data).toBeNull();
});

scenario(GROUP, 'fr.audit.log.read.main-2', async () => {
  const created = await createTask('other', uniqueTitle('tombstone-read'));
  const session = await persona('other');
  await sleep(1200);
  const before = await call('auditLog', { token: session.token, note: 'auditLog before this person erases themselves' });
  expect(before.data.auditLog.map((line) => line.target)).toContain(created.taskId);

  await erase('other');

  const after = await call('auditLog', { token: session.token, note: 'auditLog after this person\'s own erasure completed' });
  expect(after.errors).toBeNull();
  expect(Array.isArray(after.data.auditLog)).toBe(true);
  expect(after.data.auditLog.map((line) => line.target)).not.toContain(created.taskId);
});

scenario(GROUP, 'fr.audit.log.read.post-1', async () => {
  await createTask('owner', uniqueTitle('read-shape'));
  const session = await persona('owner');
  await sleep(1200);
  const asOwner = await call('auditLog', { token: session.token, note: 'auditLog as the caller who acted' });
  const lines = asOwner.data.auditLog;
  expect(lines.length).toBeGreaterThan(0);
  // The response type is the boundary: three fields, none of them an actor, a key or a chain position.
  expect(Object.keys(lines[0]).sort()).toEqual(['action', 'at', 'target']);
  const serialized = JSON.stringify(lines);
  expect(serialized).not.toMatch(SEALED_BLOB);
  expect(serialized.toLowerCase()).not.toContain('keyid');
  expect(serialized.toLowerCase()).not.toContain('prevhash');

  const exported = await call('exportMyData', { token: session.token, note: 'exportMyData as the same caller' });
  expect(exported.data.exportMyData.length).toBeGreaterThan(0);
  expect(Object.keys(exported.data.exportMyData[0]).sort()).toEqual(['action', 'at', 'target']);
});

assertImplemented(GROUP);
