import { createFakeAuditEntityManager } from './testing/fake-audit-entity-manager';
import { AuditKeystoreService } from './audit-keystore.service';
import { AuditLogService } from './audit-log.service';
import { AuditLogQuery } from './audit-log.query';
import { AuditLogHandler } from './audit-log.handler';

describe('AuditLogHandler', () => {
  it('gap.audit.operator-role todo subset: returns exactly the caller\'s own lines, never another person\'s', async () => {
    const manager = createFakeAuditEntityManager();
    const keystore = new AuditKeystoreService(manager as never);
    const log = new AuditLogService(manager as never, keystore);
    await log.append('person-1', 'sign-in', null);
    await log.append('person-2', 'sign-in', null);
    await log.append('person-1', 'task.created', 'task-1');
    const handler = new AuditLogHandler(log);

    const result = await handler.execute(new AuditLogQuery({ personId: 'person-1' }));

    expect(result.lines.map(line => line.action)).toEqual(['sign-in', 'task.created']);
  });

  it('a person with no lines gets an empty list, not an error', async () => {
    const manager = createFakeAuditEntityManager();
    const keystore = new AuditKeystoreService(manager as never);
    const log = new AuditLogService(manager as never, keystore);
    const handler = new AuditLogHandler(log);

    const result = await handler.execute(new AuditLogQuery({ personId: 'nobody' }));

    expect(result.lines).toEqual([]);
  });
});
