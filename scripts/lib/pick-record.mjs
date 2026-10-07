// The text of one pick record (scripts/lib/tier-pick.mjs): what every `--plan` output and route receipt prints.
const chainText = (chain) => (chain.length ? chain.join(' > ') : '(empty)');

/** Lines naming the tier, the chain after each step, who was dropped and why, and who was chosen by which step. */
export function pickRecordText(pick) {
  const record = pick?.record ?? pick;
  if (!record?.steps) return [];
  const lines = [`tier ${record.tier ?? '(none)'}: ${chainText(record.chain)}`];
  for (const step of record.steps) lines.push(`after ${step.step}: ${chainText(step.chain)}`);
  for (const row of record.dropped) lines.push(`dropped ${row.id} at ${row.step}: ${row.reason}`);
  if (record.balance) {
    const outcome = record.balance.applied ? '; yielded to ' + record.balance.to : '; kept ' + record.balance.kept;
    lines.push(`balance: ${record.balance.reason}${outcome}`);
  }
  lines.push(record.chosen ? `chosen ${record.chosen.id} by ${record.chosen.by}` : 'chosen none');
  return lines;
}
