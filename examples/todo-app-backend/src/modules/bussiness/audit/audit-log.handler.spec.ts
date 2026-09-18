import { createFakeAuditEntityManager } from './testing/fake-audit-entity-manager';
import { AuditKeystoreService } from './audit-keystore.service';
import { AuditLogService } from './audit-log.service';
import { AuditLogQuery } from './audit-log.query';
import { AuditLogHandler } from './audit-log.handler';
import { AuditOperatorService } from './audit-operator.service';
import { AuditOperatorRoleNotAuthorizedException } from './audit-operator-role.guard';

/**
 * A short chain across two people, appended in order, using the actions contract.audit.emitted-events
 * actually seals - so the operator filter provably runs over the emitted vocabulary, and a read that
 * crosses from person-1 to person-2 is the whole-chain read, not a same-owner read.
 */
async function buildHandler(operatorSubjects: readonly string[]) {
  const manager = createFakeAuditEntityManager();
  const keystore = new AuditKeystoreService(manager as never);
  const log = new AuditLogService(manager as never, keystore);
  await log.append('person-1', 'login.signed-in', null);
  await log.append('person-2', 'task.created', 'task-2');
  await log.append('person-1', 'task.created', 'task-1');
  return new AuditLogHandler(log, new AuditOperatorService(operatorSubjects));
}

describe('AuditLogHandler (fr.audit.log.read)', () => {
  it('a person with no lines gets an empty list, not an error', async () => {
    const manager = createFakeAuditEntityManager();
    const keystore = new AuditKeystoreService(manager as never);
    const log = new AuditLogService(manager as never, keystore);
    const handler = new AuditLogHandler(log, new AuditOperatorService([]));

    const result = await handler.execute(new AuditLogQuery({ personId: 'nobody' }));

    expect(result.lines).toEqual([]);
  });

  it('refusal (fr.audit.log.read exceptionFlows): an empty actor is refused before any line is touched', async () => {
    const handler = await buildHandler([]);

    await expect(handler.execute(new AuditLogQuery({ personId: '' }))).rejects.toBeInstanceOf(
      AuditOperatorRoleNotAuthorizedException,
    );
  });

  it('gap.audit.operator-role closed - fail-closed default: with no operator configured, a read returns only the caller\'s own lines and never the wider chain', async () => {
    const handler = await buildHandler([]);

    const result = await handler.execute(new AuditLogQuery({ personId: 'person-1' }));

    // Only person-1's own two lines, never person-2's task.created: an absent claim narrows the read to
    // the caller's own lines, it never silently widens it to the whole chain.
    expect(result.lines.map(line => line.action)).toEqual(['login.signed-in', 'task.created']);
    expect(result.lines).toHaveLength(2);
  });

  it('verifiable claim (decision.audit.operator-role): a subject outside the roster is no operator, so an action filter cannot escalate to the whole chain', async () => {
    const handler = await buildHandler(['operator-1']);

    // person-1 is not on the roster; even asking with an action filter they see only their own lines.
    // The role is minted by the trusted roster from the authenticated subject, never read from the
    // request, so there is no caller-supplied field to forge into operator breadth.
    const result = await handler.execute(new AuditLogQuery({ personId: 'person-1', action: 'task.created' }));

    const targets = result.lines.map(line => line.target);
    expect(targets).toContain('task-1');
    expect(targets).not.toContain('task-2');
  });

  it('fr.audit.log.read mainFlow: a verified operator on the roster reads the whole chain, filtered by an action the contract emits', async () => {
    const handler = await buildHandler(['operator-1']);

    const result = await handler.execute(new AuditLogQuery({ personId: 'operator-1', action: 'task.created' }));

    // Both task.created lines across both people - a cross-subject read only an operator may make.
    expect(result.lines).toHaveLength(2);
    expect(result.lines.every(line => line.action === 'task.created')).toBe(true);
    expect(result.lines.map(line => line.target).sort()).toEqual(['task-1', 'task-2']);
    // Postcondition: the summary leaks no sealed actor blob and no keyId.
    for (const line of result.lines) {
      expect(Object.keys(line).sort()).toEqual(['action', 'at', 'target']);
    }
  });

  it('fr.audit.log.read: an operator\'s unfiltered read returns every line in the chain, oldest first', async () => {
    const handler = await buildHandler(['operator-1']);

    const result = await handler.execute(new AuditLogQuery({ personId: 'operator-1' }));

    expect(result.lines.map(line => line.action)).toEqual(['login.signed-in', 'task.created', 'task.created']);
  });

  it('fr.audit.log.read: an operator filtering by an action the contract never emits gets nothing', async () => {
    const handler = await buildHandler(['operator-1']);

    const result = await handler.execute(new AuditLogQuery({ personId: 'operator-1', action: 'task.updated' }));

    expect(result.lines).toEqual([]);
  });
});
