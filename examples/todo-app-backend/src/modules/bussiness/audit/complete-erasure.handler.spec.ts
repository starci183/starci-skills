import { createFakeAuditEntityManager } from './testing/fake-audit-entity-manager';
import { AuditKeystoreService } from './audit-keystore.service';
import { AuditLogService } from './audit-log.service';
import { AuditErasureService } from './audit-erasure.service';
import { RequestErasureHandler } from './request-erasure.handler';
import { RequestErasureCommand } from './request-erasure.command';
import { CompleteErasureCommand } from './complete-erasure.command';
import { CompleteErasureHandler } from './complete-erasure.handler';

describe('CompleteErasureHandler', () => {
  it('fr.audit.erasure.complete: moves the request to complete, and export subsequently returns nothing for the subject', async () => {
    const manager = createFakeAuditEntityManager();
    const keystore = new AuditKeystoreService(manager as never);
    const log = new AuditLogService(manager as never, keystore);
    const erasureService = new AuditErasureService(manager as never, log, keystore);
    const requestHandler = new RequestErasureHandler(erasureService);
    const completeHandler = new CompleteErasureHandler(erasureService);
    await log.append('person-1', 'task.created', 'task-1');

    const requested = await requestHandler.execute(new RequestErasureCommand({ personId: 'person-1' }));
    const result = await completeHandler.execute(new CompleteErasureCommand({ requestId: requested.requestId, callerId: 'person-1' }));

    expect(result.state).toBe('complete');
    expect(await log.exportForPerson('person-1')).toEqual([]);
  });

  it('refuses when the caller is not the request\'s own subject', async () => {
    const manager = createFakeAuditEntityManager();
    const keystore = new AuditKeystoreService(manager as never);
    const log = new AuditLogService(manager as never, keystore);
    const erasureService = new AuditErasureService(manager as never, log, keystore);
    const requestHandler = new RequestErasureHandler(erasureService);
    const completeHandler = new CompleteErasureHandler(erasureService);

    const requested = await requestHandler.execute(new RequestErasureCommand({ personId: 'person-1' }));

    await expect(
      completeHandler.execute(new CompleteErasureCommand({ requestId: requested.requestId, callerId: 'person-2' })),
    ).rejects.toMatchObject({ code: 'ERASURE_REQUEST_FORBIDDEN' });
  });
});
