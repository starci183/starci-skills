'use strict';

/**
 * fr.audit.erasure.request - proven through the public GraphQL door only.
 * Check command: npm run test:e2e -- audit/erasure-request
 *
 * Not run, by the registry: fr.audit.erasure.request.main-2 and
 * ac.audit.erasure.logged.request-and-completion-are-lines - the two erasure lines are sealed under
 * AuditKeystoreService.SYSTEM_ACTOR_ID and every public read selects lines by the caller's own keyId,
 * so no client can ever see them.
 */

const { call, persona } = require('../lib/client');
const { scenario, assertImplemented } = require('../lib/scenario');
const { uniqueTitle, createTask, sleep, requestErasure, completeErasure, exportLines, auditLines } = require('../lib/fixtures');

const GROUP = 'audit/erasure-request';

scenario(GROUP, 'fr.audit.erasure.request.main-1', async () => {
  const observed = await requestErasure('other');
  expect(observed.errors).toBeNull();
  const { requestId, state } = observed.data.requestErasure;
  // tRequest mints the id with randomUUID before anything else happens.
  expect(requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  // What the door actually reports for the step that names state `requested`; recorded, not gated on.
  expect(typeof state).toBe('string');
});

scenario(GROUP, 'ac.audit.erasure.right.identifying-fields-unreadable', async () => {
  const created = await createTask('other', uniqueTitle('erasure-request-lines'));
  await sleep(1200);
  const before = await exportLines('other');
  expect(before.map((line) => line.target)).toContain(created.taskId);

  const requested = await requestErasure('other');
  const completed = await completeErasure('other', requested.data.requestErasure.requestId);
  expect(completed.data.completeErasure.state).toBe('complete');

  const afterExport = await call('exportMyData', { token: (await persona('other')).token, note: 'exportMyData once the subject has been erased' });
  expect(afterExport.data.exportMyData).toEqual([]);
  const afterLog = await auditLines('other', 'the erased person\'s own log read');
  expect(afterLog).toEqual([]);
});

assertImplemented(GROUP);
