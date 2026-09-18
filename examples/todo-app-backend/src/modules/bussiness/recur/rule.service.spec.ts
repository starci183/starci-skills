import { RuleEntity } from '../../platform/databases/postgresql/primary';
import { createFakeRecurEntityManager } from './testing/fake-recur-entity-manager';
import { RuleService } from './rule.service';

describe('RuleService (data.recur.rule)', () => {
  const build = () => new RuleService(createFakeRecurEntityManager() as never);

  it('creates an every-weekday rule owned by the submitter', async () => {
    const service = build();
    const rule = await service.create({
      owner: 'owner-1',
      title: 'Morning routine',
      frequency: 'every-weekday',
      timeZone: 'Europe/Berlin',
      time: '09:00',
      startDate: '2026-09-14',
    });
    expect(rule.owner).toBe('owner-1');
    expect(rule.endedAt).toBeNull();
  });

  it('data.recur.rule invariant: every-n-days requires a positive integer n', async () => {
    const service = build();
    await expect(
      service.create({ owner: 'owner-1', title: 'x', frequency: 'every-n-days', timeZone: 'UTC', time: '09:00', startDate: '2026-01-01' }),
    ).rejects.toMatchObject({ code: 'RECUR_RULE_INVALID' });
  });

  it('data.recur.rule invariant: monthly-day requires dayOfMonth between 1 and 31', async () => {
    const service = build();
    await expect(
      service.create({
        owner: 'owner-1',
        title: 'x',
        frequency: 'monthly-day',
        dayOfMonth: 32,
        timeZone: 'UTC',
        time: '09:00',
        startDate: '2026-01-01',
      }),
    ).rejects.toMatchObject({ code: 'RECUR_RULE_INVALID' });
  });

  it('decision.recur.impossible-date: monthly-day 31 is accepted at creation even though most months lack a 31st', async () => {
    const service = build();
    const rule = await service.create({
      owner: 'owner-1',
      title: 'Rent',
      frequency: 'monthly-day',
      dayOfMonth: 31,
      timeZone: 'UTC',
      time: '09:00',
      startDate: '2026-01-01',
    });
    expect(rule.dayOfMonth).toBe(31);
  });

  it('ac.recur.occurrence.owned-by-rule-owner (rule half): a stranger cannot edit or end the rule', async () => {
    const service = build();
    const rule = await service.create({
      owner: 'owner-1',
      title: 'x',
      frequency: 'every-weekday',
      timeZone: 'UTC',
      time: '09:00',
      startDate: '2026-01-01',
    });
    await expect(service.edit(rule.id, 'owner-2', { time: '10:00' })).rejects.toMatchObject({ code: 'RECUR_RULE_FORBIDDEN' });
    await expect(service.end(rule.id, 'owner-2', '2026-02-01')).rejects.toMatchObject({ code: 'RECUR_RULE_FORBIDDEN' });
  });

  it('fr.recur.edit-rule: the owner can change frequency, time and time zone', async () => {
    const service = build();
    const rule = await service.create({
      owner: 'owner-1',
      title: 'x',
      frequency: 'every-weekday',
      timeZone: 'UTC',
      time: '09:00',
      startDate: '2026-01-01',
    });
    const edited = await service.edit(rule.id, 'owner-1', { time: '10:30', timeZone: 'Europe/Berlin' });
    expect(edited.time).toBe('10:30');
    expect(edited.timeZone).toBe('Europe/Berlin');
  });

  it('br.recur.ending.preserves-history: ending sets endedAt and never clears it back', async () => {
    const service = build();
    const rule = await service.create({
      owner: 'owner-1',
      title: 'x',
      frequency: 'every-weekday',
      timeZone: 'UTC',
      time: '09:00',
      startDate: '2026-01-01',
    });
    const ended = await service.end(rule.id, 'owner-1', '2026-09-15');
    expect(ended.endedAt).toBe('2026-09-15');
  });

  it('findById refuses an unknown rule id', async () => {
    const service = build();
    await expect(service.findById('missing')).rejects.toMatchObject({ code: 'RECUR_RULE_NOT_FOUND' });
  });
});
