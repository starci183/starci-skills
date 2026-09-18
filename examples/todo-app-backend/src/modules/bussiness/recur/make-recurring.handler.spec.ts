import { createFakeRecurEntityManager } from './testing/fake-recur-entity-manager';
import { RuleService } from './rule.service';
import { MakeRecurringCommand } from './make-recurring.command';
import { MakeRecurringHandler } from './make-recurring.handler';

describe('MakeRecurringHandler (fr.recur.make-recurring)', () => {
  const build = () => {
    const ruleService = new RuleService(createFakeRecurEntityManager() as never);
    return { ruleService, handler: new MakeRecurringHandler(ruleService) };
  };

  it('fr.recur.make-recurring: exactly one rule is created, owned by the submitter', async () => {
    const { handler, ruleService } = build();
    const result = await handler.execute(
      new MakeRecurringCommand({
        ownerId: 'owner-1',
        title: 'Morning routine',
        frequency: 'every-weekday',
        timeZone: 'Europe/Berlin',
        time: '09:00',
        startDate: '2026-09-14',
      }),
    );
    expect(result.ruleId).toEqual(expect.any(String));
    const rules = await ruleService.listOwnedBy('owner-1');
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe(result.ruleId);
  });

  it('decision.recur.impossible-date: a monthly-day rule naming the 31st is accepted, not refused at creation', async () => {
    const { handler } = build();
    const result = await handler.execute(
      new MakeRecurringCommand({
        ownerId: 'owner-1',
        title: 'Rent',
        frequency: 'monthly-day',
        dayOfMonth: 31,
        timeZone: 'UTC',
        time: '09:00',
        startDate: '2026-01-01',
      }),
    );
    expect(result.frequency).toBe('monthly-day');
  });
});
