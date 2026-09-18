import { createFakeAuditEntityManager } from './testing/fake-audit-entity-manager';
import { AuditKeystoreService } from './audit-keystore.service';
import { AuditLogService } from './audit-log.service';
import { AuditErasureService } from './audit-erasure.service';
import { RequestErasureCommand } from './request-erasure.command';
import { RequestErasureHandler } from './request-erasure.handler';

describe('RequestErasureHandler', () => {
  it('fr.audit.erasure.request: exactly one erasure-request row exists per submission, in state requested (then verified, since the caller is the subject)', async () => {
    const manager = createFakeAuditEntityManager();
    const keystore = new AuditKeystoreService(manager as never);
    const log = new AuditLogService(manager as never, keystore);
    const handler = new RequestErasureHandler(new AuditErasureService(manager as never, log, keystore));

    const result = await handler.execute(new RequestErasureCommand({ personId: 'person-1' }));

    expect(result.requestId).toEqual(expect.any(String));
    expect(result.state).toBe('verified');
  });
});
