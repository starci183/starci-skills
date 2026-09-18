'use strict';

/**
 * fr.recur.end-rule - proven through the public GraphQL door only.
 * Check command: npm run test:e2e -- recur/end-rule
 *
 * Not run, by the registry: ac.recur.ending.preserves-history.ended-rule-keeps-past-occurrences, whose
 * given clause needs an occurrence whose status is already completed and no public operation can set one.
 */

const { scenario, assertImplemented } = require('../lib/scenario');
const {
  uniqueTitle, makeRule, endRule, upcoming, occurrencesAfterTick, localDates, occurrenceOn, localDateOffset, sleep,
} = require('../lib/fixtures');

const GROUP = 'recur/end-rule';

/** A daily rule already three days old, with its occurrences materialised by a real generator tick. */
async function threeDayRule(label) {
  const rule = await makeRule('owner', {
    title: uniqueTitle(label), frequency: 'every-n-days', n: 1, timeZone: 'UTC', time: '09:00', startDate: localDateOffset(-3),
  });
  const occurrences = await occurrencesAfterTick(rule.ruleId, 'owner', 3);
  return { rule, occurrences };
}

scenario(GROUP, 'fr.recur.end-rule.main-1', async () => {
  const { rule, occurrences } = await threeDayRule('end-rule-main-1');
  const dates = localDates(occurrences);
  const endedAt = dates[dates.length - 2];
  const observed = await endRule('owner', rule.ruleId, endedAt);
  expect(observed.errors).toBeNull();
  expect(observed.data.endRecurrence.ruleId).toBe(rule.ruleId);
  expect(observed.data.endRecurrence.endedAt).toBe(endedAt);
  expect(observed.data.endRecurrence.orphanedCount).toBeGreaterThan(0);
});

scenario(GROUP, 'fr.recur.end-rule.main-2', async () => {
  const { rule, occurrences } = await threeDayRule('end-rule-main-2');
  const dates = localDates(occurrences);
  const endedAt = dates[dates.length - 2];
  await endRule('owner', rule.ruleId, endedAt);
  const atEnd = localDates((await upcoming('owner', rule.ruleId)).data.upcomingOccurrences);

  await sleep(6000);
  const later = await upcoming('owner', rule.ruleId, 'upcomingOccurrences after more generator ticks');
  const laterDates = localDates(later.data.upcomingOccurrences);
  for (const date of laterDates) {
    expect(date <= endedAt || atEnd.includes(date)).toBe(true);
  }
  expect(laterDates.filter((date) => date > endedAt)).toEqual(atEnd.filter((date) => date > endedAt));
});

scenario(GROUP, 'fr.recur.end-rule.main-3', async () => {
  const { rule, occurrences } = await threeDayRule('end-rule-main-3');
  const before = localDates(occurrences);
  const endedAt = before[before.length - 2];
  const orphaned = await endRule('owner', rule.ruleId, endedAt);
  expect(orphaned.errors).toBeNull();

  const after = await upcoming('owner', rule.ruleId, 'upcomingOccurrences once the rule has ended');
  const rows = after.data.upcomingOccurrences.materialised;
  expect(localDates(after.data.upcomingOccurrences)).toEqual(before);
  for (const row of rows.filter((occurrence) => occurrence.localDate >= endedAt)) {
    expect(row.status).toBe('orphaned');
  }
  for (const row of rows.filter((occurrence) => occurrence.localDate < endedAt)) {
    expect(row.status).toBe('materialised');
  }
});

scenario(GROUP, 'fr.recur.end-rule.post-1', async () => {
  const { rule, occurrences } = await threeDayRule('end-rule-post-1');
  const before = occurrences.materialised;
  const endedAt = localDates(occurrences)[localDates(occurrences).length - 1];
  const observed = await endRule('owner', rule.ruleId, endedAt);
  expect(observed.data.endRecurrence.endedAt).toBe(endedAt);

  const after = await upcoming('owner', rule.ruleId, 'upcomingOccurrences to check nothing was deleted');
  const afterRows = after.data.upcomingOccurrences.materialised;
  expect(afterRows.map((row) => row.occurrenceId).sort()).toEqual(before.map((row) => row.occurrenceId).sort());
  expect(occurrenceOn(after.data.upcomingOccurrences, endedAt).length).toBe(1);
});

assertImplemented(GROUP);
