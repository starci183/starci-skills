import { ExecutionContext } from '@nestjs/common';
import { AuditOperatorGuard } from './audit-operator.guard';
import {
  AUDIT_SEALED_ACTIONS,
  assertOperatorRead,
  isOperatorRead,
  matchOperatorFilter,
  toAuditLineSummary,
} from './audit-operator-read';
import { AuditOperatorRoleNotAuthorizedException } from './audit-operator-role.guard';
import { createFakeAuditEntityManager } from './testing/fake-audit-entity-manager';
import { AuditKeystoreService } from './audit-keystore.service';
import { AuditLogService } from './audit-log.service';

/** gap.audit.operator-role (rev 2): the operator check is real and fail-closed - a missing or unknown
 * role claim is the refusal this gap names, never a fallback grant; operator/operator:* pass. */
describe('assertOperatorRead (gap.audit.operator-role)', () => {
  it('refuses every actor without an operator claim - which is every actor this example can resolve today', () => {
    expect(() => assertOperatorRead({ personId: 'person-1' })).toThrow(AuditOperatorRoleNotAuthorizedException);
    expect(() => assertOperatorRead({ personId: 'person-1', role: 'person' })).toThrow(AuditOperatorRoleNotAuthorizedException);
    expect(() => assertOperatorRead({ personId: 'person-1', role: '' })).toThrow(AuditOperatorRoleNotAuthorizedException);
  });

  it('honors operator and operator:* claims if sds.login.session-store ever grows a role field', () => {
    expect(() => assertOperatorRead({ personId: 'op-1', role: 'operator' })).not.toThrow();
    expect(() => assertOperatorRead({ personId: 'op-1', role: 'operator:*' })).not.toThrow();
  });

  it('carries a stable refusal code, per contract.login.identity-for-task\'s typed-refusal rule', () => {
    try {
      assertOperatorRead({ personId: 'person-1' });
      throw new Error('assertOperatorRead should have refused');
    } catch (error) {
      expect((error as AuditOperatorRoleNotAuthorizedException).code).toBe('AUDIT_OPERATOR_ROLE_NOT_AUTHORIZED');
    }
  });

  it('asks and asserts the same one rule', () => {
    for (const role of [undefined, 'person', 'operator', 'operator:*']) {
      const claims = { personId: 'x', role };
      const assertedThrows = (() => {
        try {
          assertOperatorRead(claims);
          return false;
        } catch {
          return true;
        }
      })();
      expect(isOperatorRead(claims)).toBe(!assertedThrows);
    }
  });
});

/** The refusal fires before any line is touched - fr.audit.log.read's exceptionFlows, and the
 * transport face denies an unresolved actor rather than guessing one. */
describe('AuditOperatorGuard', () => {
  const guard = new AuditOperatorGuard();
  const contextFor = (actor?: unknown): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => (actor === undefined ? {} : { actor }) }),
    }) as unknown as ExecutionContext;

  it('denies the session-only actor this example resolves today (SessionRecord carries no role)', () => {
    expect(() => guard.assertCanRead({ personId: 'person-1' })).toThrow(AuditOperatorRoleNotAuthorizedException);
    expect(() => guard.canActivate(contextFor({ personId: 'person-1' }))).toThrow(AuditOperatorRoleNotAuthorizedException);
    expect(() => guard.canActivate(contextFor())).toThrow(AuditOperatorRoleNotAuthorizedException);
  });

  it('admits an operator claim', () => {
    expect(guard.canActivate(contextFor({ personId: 'op-1', role: 'operator' }))).toBe(true);
    expect(guard.canRead({ personId: 'op-1', role: 'operator:*' })).toBe(true);
    expect(guard.canRead({ personId: 'person-1' })).toBe(false);
  });
});

/** fr.audit.log.read's trigger and postcondition, proven over the real store: the filter pair runs on
 * lines resolved through the same readLine the own-lines read uses, and no response shape can carry a
 * sealed actor blob or a keyId. */
describe('operator filter/summary pair (fr.audit.log.read)', () => {
  const line = (at: Date, action: string, target: string | null) => ({ at, action, target, actor: null, tombstoned: false });

  it('filters by action and by target, and passes everything when unfiltered', () => {
    const rows = [line(new Date(), 'task.created', 'task-1'), line(new Date(), 'task.completed', 'task-2'), line(new Date(), 'login.signed-in', null)];
    expect(rows.filter(r => matchOperatorFilter(r, { action: 'task.completed' })).map(r => r.target)).toEqual(['task-2']);
    expect(rows.filter(r => matchOperatorFilter(r, { target: 'task-1' }))).toHaveLength(1);
    expect(rows.filter(r => matchOperatorFilter(r, {}))).toHaveLength(3);
  });

  it('the summary carries exactly at/action/target - never actor, never keyId', () => {
    const summary = toAuditLineSummary({ ...line(new Date(), 'sign-in', null), actor: 'person-1', tombstoned: false });
    expect(Object.keys(summary).sort()).toEqual(['action', 'at', 'target']);
  });

  it('readAllLines resolves a real tombstoned line into the same summary shape, unreadable but present', async () => {
    const manager = createFakeAuditEntityManager();
    const keystore = new AuditKeystoreService(manager as never);
    const log = new AuditLogService(manager as never, keystore);
    await log.append('person-1', 'sign-in', null);
    await log.append('person-2', 'task.created', 'task-9');
    await keystore.destroyKey('person-1');

    const rows = await log.readAllLines();
    expect(rows).toHaveLength(2);
    expect(rows[0].tombstoned).toBe(true);
    expect(rows[0].actor).toBe(null);
    expect(rows[1].actor).toBe('person-2');
    const summaries = rows.map(toAuditLineSummary);
    expect(JSON.stringify(summaries)).not.toMatch(/person-1/);
    expect(JSON.stringify(summaries)).not.toMatch(/keyId/);
  });
});

/** contract.audit.emitted-events' consumer half as data: exactly the five declared kinds, and the
 * audit-event.subscriber.spec.ts routing proves each one seals its mapped action. */
describe('AUDIT_SEALED_ACTIONS (contract.audit.emitted-events)', () => {
  it('names exactly the five events this lane declares', () => {
    expect(Object.keys(AUDIT_SEALED_ACTIONS).sort()).toEqual([
      'event.login.signed-in',
      'event.login.signed-out',
      'event.task.completed',
      'event.task.created',
      'event.task.deleted',
    ]);
  });
});
