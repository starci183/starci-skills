// The one picking function for every seat and every operation (modules/models/tiers.yaml owns the data).
// Precedence: hard filter > owner bias > a live seat keeps its member > balance > chain order by tokens.
// Pure: the caller supplies each member's facts (hard-filter codes, token use) and the tier's recent picks.

const matchesSelector = (member, selector) => Object.entries(selector).every(([key, value]) => (key === 'agent' ? member.provider : member[key]) === value);
const named = (member, selectors) => selectors.some((selector) => matchesSelector(member, selector));
const drop = (record, step, member, reason) => record.dropped.push({ id: member.id, step, reason });
const snapshot = (record, step, chain) => record.steps.push({ step, chain: chain.map((member) => member.id) });

/** Step 1: members a bias can never restore (auth, host, circuit, role, capacity). */
function hardFilter(chain, record) {
  const kept = [];
  for (const member of chain) {
    if (member.hard?.length) drop(record, 'hard-filter', member, member.hard[0]);
    else kept.push(member);
  }
  snapshot(record, 'hard-filter', kept);
  return kept;
}

/** Step 2: only leaves the named members, avoid removes, prefer moves to the front. An emptied chain refuses. */
function applyBias(chain, bias, record) {
  const only = bias.only ?? [], avoid = bias.avoid ?? [], prefer = bias.prefer ?? [];
  let next = only.length ? chain.filter((member) => named(member, only)) : chain;
  for (const member of chain) if (!next.includes(member)) drop(record, 'bias', member, 'not named by only');
  const avoided = next.filter((member) => named(member, avoid));
  for (const member of avoided) drop(record, 'bias', member, 'avoided by the owner');
  next = next.filter((member) => !avoided.includes(member));
  next = [...next.filter((member) => named(member, prefer)), ...next.filter((member) => !named(member, prefer))];
  snapshot(record, 'bias', next);
  return next;
}

const usageOf = (member) => (Number.isFinite(member.pressure) ? member.pressure : 0);

/** Step 5 verdict of one member: null when it has tokens, else the reason it is skipped. `allowBand` widens 90..95. */
function tokenVerdict(member, usage, allowBand) {
  const used = usageOf(member);
  if (used >= usage.exhaustedPercent) return 'exhausted';
  if (used >= usage.biasPercent) return `at ${usage.biasPercent}% or more of its tokens`;
  if (used >= usage.reservePercent && !allowBand) return `at ${usage.reservePercent}% or more of its tokens (reserve)`;
  return null;
}

/** Whether a bias or an owner reserve grant names this member, so its 90..95 band stays usable. */
const bandAllowed = (member, { bias, override }) => Boolean(bias.trusted !== false && named(member, [...(bias.prefer ?? []), ...(bias.only ?? [])]))
  || Boolean(override && matchesSelector(member, override));

function streakOf(recent, headId) {
  let streak = 0;
  for (const id of recent) {
    if (id !== headId) break;
    streak += 1;
  }
  return streak;
}

function shareOf(running, headId) {
  const total = Object.values(running).reduce((sum, count) => sum + count, 0);
  return total > 0 ? ((running[headId] ?? 0) / total) * 100 : 0;
}

/** Step 4: a head picked maxStreak times in a row, or over maxSharePercent of the running seats, yields to the next member with tokens. */
function balanceChain(chain, ctx) {
  const { history, balance, record } = ctx;
  const head = chain[0];
  if (chain.length < 2) return { chain, yielded: null };
  const streak = streakOf(history.recent ?? [], head.id), share = shareOf(history.running ?? {}, head.id);
  const reason = streak >= balance.maxStreak ? `${head.id} was picked ${streak} times in a row`
    : share > balance.maxSharePercent ? `${head.id} holds ${Math.round(share)}% of the running seats` : null;
  if (!reason) return { chain, yielded: null };
  const next = chain.slice(1).find((member) => tokenVerdict(member, ctx.usage, bandAllowed(member, ctx)) === null);
  if (!next) {
    record.balance = { applied: false, reason, kept: head.id, why: 'no next member passes the hard filter and the token step' };
    return { chain, yielded: null };
  }
  record.balance = { applied: true, reason, yieldedFrom: head.id, to: next.id };
  return { chain: [next, ...chain.filter((member) => member !== next)], yielded: reason };
}

/** Step 5: the first member with tokens; the skipped ones and the earliest reset are recorded. */
function takeByTokens(chain, ctx) {
  const { record, usage } = ctx;
  const ordered = [];
  for (const member of chain) {
    const reason = tokenVerdict(member, usage, bandAllowed(member, ctx));
    if (reason) drop(record, 'tokens', member, reason);
    else ordered.push(member);
  }
  snapshot(record, 'tokens', ordered);
  return ordered;
}

const earliestReset = (chain) => chain.map((member) => member.resetsAt).filter((at) => at != null).sort((a, b) => a - b)[0] ?? null;

function finish(record, { ok, selected = null, chosenBy = null, reason = null, order = [], resetAt = null }) {
  record.chosen = selected ? { id: selected.id, by: chosenBy } : null;
  return { ok, selected, chosenBy, reason, order, resetAt, record };
}

/**
 * Pick one member of a tier. Input: {tier, members (chain order), bias {prefer, avoid, only, trusted}, override,
 * liveSeat (member id), history {recent: [ids, newest first], running: {id: n}}, balance {maxStreak, maxSharePercent},
 * usage {reservePercent, biasPercent, exhaustedPercent}}. Output: {ok, selected, chosenBy, reason, order, resetAt, record}.
 */
export function pickFromTier({ tier, members, bias = {}, override = null, liveSeat = null, history = {}, balance, usage }) {
  const record = { tier, chain: members.map((member) => member.id), steps: [], dropped: [], chosen: null };
  const ctx = { bias, override, history, balance, usage, record };
  const hard = hardFilter(members, record);
  if (!hard.length) return finish(record, { ok: false, reason: `no member of tier ${tier} passes the hard filter: ${record.dropped.map((row) => `${row.id} ${row.reason}`).join('; ')}`, resetAt: earliestReset(members) });
  const biased = applyBias(hard, bias, record);
  if (!biased.length) return finish(record, { ok: false, reason: `the owner bias leaves no member of tier ${tier} (${record.dropped.filter((row) => row.step === 'bias').map((row) => `${row.id} ${row.reason}`).join('; ')})` });
  const live = liveSeat ? biased.find((member) => member.id === liveSeat) : null;
  if (live) {
    snapshot(record, 'live-seat', [live]);
    return finish(record, { ok: true, selected: live, chosenBy: 'live-seat', order: [live] });
  }
  const biasActive = Boolean((bias.only ?? []).length || (bias.prefer ?? []).length);
  const balanced = biasActive ? { chain: biased, yielded: null } : balanceChain(biased, ctx);
  snapshot(record, 'balance', balanced.chain);
  const ordered = takeByTokens(balanced.chain, ctx);
  if (!ordered.length) return finish(record, { ok: false, reason: `every member of tier ${tier} is out of tokens: ${record.dropped.filter((row) => row.step === 'tokens').map((row) => `${row.id} ${row.reason}`).join('; ')}`, resetAt: earliestReset(balanced.chain) });
  let chosenBy = 'chain-order';
  if (biasActive) chosenBy = 'bias';
  else if (balanced.yielded && ordered[0] === balanced.chain[0]) chosenBy = 'balance';
  else if (record.dropped.some((row) => row.step === 'tokens')) chosenBy = 'tokens';
  return finish(record, { ok: true, selected: ordered[0], chosenBy, order: ordered });
}
