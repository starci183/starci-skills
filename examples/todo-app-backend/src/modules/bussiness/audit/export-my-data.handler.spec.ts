import { createFakeAuditEntityManager } from './testing/fake-audit-entity-manager';
import { AuditKeystoreService } from './audit-keystore.service';
import { AuditLogService } from './audit-log.service';
import { AuditErasureService } from './audit-erasure.service';
import { ExportMyDataQuery } from './export-my-data.query';
import { ExportMyDataHandler } from './export-my-data.handler';

describe('ExportMyDataHandler', () => {
  it('fr.audit.export: the export contains no other person\'s lines', async () => {
    const manager = createFakeAuditEntityManager();
    const keystore = new AuditKeystoreService(manager as never);
    const log = new AuditLogService(manager as never, keystore);
    await log.append('person-1', 'task.created', 'task-1');
    await log.append('person-2', 'task.created', 'task-2');
    const handler = new ExportMyDataHandler(log);

    const result = await handler.execute(new ExportMyDataQuery({ personId: 'person-1' }));

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].target).toBe('task-1');
  });

  it("exceptionFlow: once the person's key has been destroyed by a completed erasure, export returns nothing", async () => {
    const manager = createFakeAuditEntityManager();
    const keystore = new AuditKeystoreService(manager as never);
    const log = new AuditLogService(manager as never, keystore);
    const erasureService = new AuditErasureService(manager as never, log, keystore);
    await log.append('person-1', 'task.created', 'task-1');
    const requested = await erasureService.request('person-1');
    await erasureService.execute(requested.requestId, 'person-1');
    const handler = new ExportMyDataHandler(log);

    const result = await handler.execute(new ExportMyDataQuery({ personId: 'person-1' }));

    expect(result.lines).toEqual([]);
  });
});
