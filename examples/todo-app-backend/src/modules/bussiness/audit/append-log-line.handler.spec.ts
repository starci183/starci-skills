import { createFakeAuditEntityManager } from './testing/fake-audit-entity-manager';
import { AuditKeystoreService } from './audit-keystore.service';
import { AuditLogService } from './audit-log.service';
import { AppendLogLineCommand } from './append-log-line.command';
import { AppendLogLineHandler } from './append-log-line.handler';

describe('AppendLogLineHandler', () => {
  it('fr.audit.log.append: appends a line and reports the count increasing by exactly one', async () => {
    const manager = createFakeAuditEntityManager();
    const log = new AuditLogService(manager as never, new AuditKeystoreService(manager as never));
    const handler = new AppendLogLineHandler(log);

    const before = await log.verifyChain();
    const result = await handler.execute(new AppendLogLineCommand({ actorId: 'person-1', action: 'sign-in', target: null }));
    const after = await log.verifyChain();

    expect(after.totalLines).toBe(before.totalLines + 1);
    expect(after.valid).toBe(true);
    expect(result.lineId).toEqual(expect.any(String));
  });
});
