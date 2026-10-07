// The one picker (scripts/lib/tier-pick.mjs): hard filter > owner bias > live seat > balance > chain order by tokens.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pickFromTier } from '../../scripts/lib/tier-pick.mjs';
import { pickRecordText } from '../../scripts/lib/pick-record.mjs';

const usage = { reservePercent: 90, biasPercent: 95, exhaustedPercent: 100 };
const balance = { maxStreak: 3, maxSharePercent: 70 };
const member = (id, extra = {}) => ({ id, provider: id.split('/')[0], model: id.split('/')[1], pressure: 0, hard: [], ...extra });
const sonnet = (extra) => member('claude/sonnet', extra);
const sol = (extra) => member('codex/sol', extra);
const pick = (members, rest = {}) => pickFromTier({ tier: 'high', members, balance, usage, ...rest });

test('chain order: the first member with tokens is taken', () => {
  const picked = pick([sonnet({ pressure: 8 }), sol()]);
  assert.equal(picked.selected.id, 'claude/sonnet');
  assert.equal(picked.chosenBy, 'chain-order');
  assert.deepEqual(picked.record.chosen, { id: 'claude/sonnet', by: 'chain-order' });
});

test('automatic picking skips a member at 90 percent or more of its tokens', () => {
  const picked = pick([sonnet({ pressure: 90 }), sol()]);
  assert.equal(picked.selected.id, 'codex/sol');
  assert.equal(picked.chosenBy, 'tokens');
  assert.equal(picked.record.dropped[0].id, 'claude/sonnet');
  assert.equal(picked.record.dropped[0].step, 'tokens');
});

test('a bias naming the member uses it at 92 percent and refuses it at 96 percent', () => {
  const named = { prefer: [{ provider: 'claude' }] };
  assert.equal(pick([sonnet({ pressure: 92 }), sol()], { bias: named }).selected.id, 'claude/sonnet');
  const only = { only: [{ provider: 'claude' }] };
  assert.equal(pick([sonnet({ pressure: 92 }), sol()], { bias: only }).selected.id, 'claude/sonnet');
  const refused = pick([sonnet({ pressure: 96 }), sol()], { bias: only });
  assert.equal(refused.ok, false);
  assert.match(refused.reason, /out of tokens/);
  assert.equal(pick([sonnet({ pressure: 95 }), sol()], { bias: only }).ok, false);
});

test('an untrusted bias never widens the 90 to 95 band', () => {
  const picked = pick([sonnet({ pressure: 92 }), sol()], { bias: { prefer: [{ provider: 'claude' }], trusted: false } });
  assert.equal(picked.selected.id, 'codex/sol');
});

test('an owner reserve grant for the exact member widens the band to 95 and no further', () => {
  const override = { provider: 'claude', model: 'sonnet' };
  assert.equal(pick([sonnet({ pressure: 93 }), sol()], { override }).selected.id, 'claude/sonnet');
  assert.equal(pick([sonnet({ pressure: 96 }), sol()], { override }).selected.id, 'codex/sol');
});

test('the whole chain in reserve or exhausted is refused and reports the earliest reset', () => {
  const picked = pick([sonnet({ pressure: 91, resetsAt: 2000 }), sol({ pressure: 100, resetsAt: 1000 })]);
  assert.equal(picked.ok, false);
  assert.equal(picked.resetAt, 1000);
  assert.match(picked.reason, /every member of tier high is out of tokens/);
});

test('an exhausted member is never used, with or without a bias', () => {
  const picked = pick([sonnet({ pressure: 100 }), sol()], { bias: { prefer: [{ provider: 'claude' }] } });
  assert.equal(picked.selected.id, 'codex/sol');
});

test('a streak of three yields the fourth pick to the next member', () => {
  const history = { recent: ['claude/sonnet', 'claude/sonnet', 'claude/sonnet'], running: {} };
  const picked = pick([sonnet(), sol()], { history });
  assert.equal(picked.selected.id, 'codex/sol');
  assert.equal(picked.chosenBy, 'balance');
  assert.equal(picked.record.balance.applied, true);
  assert.equal(pick([sonnet(), sol()], { history: { recent: ['claude/sonnet', 'claude/sonnet'], running: {} } }).selected.id, 'claude/sonnet');
  assert.equal(pick([sonnet(), sol()], { history: { recent: ['claude/sonnet', 'codex/sol', 'claude/sonnet'], running: {} } }).selected.id, 'claude/sonnet');
});

test('a head holding more than 70 percent of the running seats yields', () => {
  const over = pick([sonnet(), sol()], { history: { recent: [], running: { 'claude/sonnet': 8, 'codex/sol': 3 } } });
  assert.equal(over.selected.id, 'codex/sol');
  const at = pick([sonnet(), sol()], { history: { recent: [], running: { 'claude/sonnet': 7, 'codex/sol': 3 } } });
  assert.equal(at.selected.id, 'claude/sonnet');
});

test('balance yields only when the next member is eligible', () => {
  const history = { recent: ['claude/sonnet', 'claude/sonnet', 'claude/sonnet'], running: {} };
  const hardOut = pick([sonnet(), sol({ hard: ['capacity-full'] })], { history });
  assert.equal(hardOut.selected.id, 'claude/sonnet');
  assert.equal(hardOut.record.balance, undefined);
  const noTokens = pick([sonnet(), sol({ pressure: 91 })], { history });
  assert.equal(noTokens.selected.id, 'claude/sonnet');
  assert.equal(noTokens.record.balance.applied, false);
});

test('a live seat keeps its member whatever balance or tokens say', () => {
  const history = { recent: ['claude/sonnet', 'claude/sonnet', 'claude/sonnet'], running: { 'claude/sonnet': 9 } };
  const picked = pick([sonnet({ pressure: 93 }), sol()], { history, liveSeat: 'claude/sonnet' });
  assert.equal(picked.selected.id, 'claude/sonnet');
  assert.equal(picked.chosenBy, 'live-seat');
});

test('a live seat whose member the hard filter dropped is replaced by the chain', () => {
  const picked = pick([sonnet({ hard: ['provider-blocked'] }), sol()], { liveSeat: 'claude/sonnet' });
  assert.equal(picked.selected.id, 'codex/sol');
});

test('a bias beats balance', () => {
  const history = { recent: ['claude/sonnet', 'claude/sonnet', 'claude/sonnet'], running: { 'claude/sonnet': 9 } };
  const picked = pick([sonnet(), sol()], { history, bias: { prefer: [{ provider: 'claude' }] } });
  assert.equal(picked.selected.id, 'claude/sonnet');
  assert.equal(picked.chosenBy, 'bias');
  assert.equal(picked.record.balance, undefined);
});

test('prefer moves the member to the front and avoid removes it', () => {
  assert.equal(pick([sonnet(), sol()], { bias: { prefer: [{ provider: 'codex' }] } }).selected.id, 'codex/sol');
  const avoided = pick([sonnet(), sol()], { bias: { avoid: [{ provider: 'claude' }] } });
  assert.equal(avoided.selected.id, 'codex/sol');
  assert.deepEqual(avoided.record.dropped.map((row) => [row.id, row.step]), [['claude/sonnet', 'bias']]);
});

test('a bias that empties the chain refuses with the reason and never drops the bias', () => {
  const picked = pick([sonnet(), sol()], { bias: { avoid: [{ provider: 'claude' }, { provider: 'codex' }] } });
  assert.equal(picked.ok, false);
  assert.match(picked.reason, /owner bias leaves no member of tier high/);
  const onlyDevin = pick([sonnet(), sol()], { bias: { only: [{ provider: 'devin' }] } });
  assert.equal(onlyDevin.ok, false);
  assert.match(onlyDevin.reason, /not named by only/);
});

test('the hard filter beats a bias', () => {
  const picked = pick([sonnet({ hard: ['quota-stale'] }), sol()], { bias: { only: [{ provider: 'claude' }] } });
  assert.equal(picked.ok, false);
  assert.deepEqual(picked.record.dropped.map((row) => [row.id, row.step]), [['claude/sonnet', 'hard-filter'], ['codex/sol', 'bias']]);
  assert.match(picked.reason, /owner bias leaves no member/);
  const preferred = pick([sonnet({ hard: ['incident-open'] }), sol()], { bias: { prefer: [{ provider: 'claude' }] } });
  assert.equal(preferred.selected.id, 'codex/sol');
});

test('a single-member tier (imagegen) stops when that member is out of tokens', () => {
  const picked = pickFromTier({ tier: 'imagegen', members: [sol({ pressure: 91 })], balance, usage });
  assert.equal(picked.ok, false);
  assert.match(picked.reason, /every member of tier imagegen is out of tokens/);
  assert.equal(pickFromTier({ tier: 'imagegen', members: [sol()], balance, usage }).selected.id, 'codex/sol');
});

test('the pick record names the tier, the chain after each step, the dropped members and the chosen one', () => {
  const picked = pick([sonnet({ pressure: 93 }), sol({ hard: ['capacity-full'] }), member('devin/max')]);
  assert.equal(picked.selected.id, 'devin/max');
  assert.equal(picked.record.tier, 'high');
  assert.deepEqual(picked.record.chain, ['claude/sonnet', 'codex/sol', 'devin/max']);
  assert.deepEqual(picked.record.steps.map((row) => row.step), ['hard-filter', 'bias', 'balance', 'tokens']);
  assert.deepEqual(picked.record.steps[0].chain, ['claude/sonnet', 'devin/max']);
  assert.deepEqual(picked.record.dropped.map((row) => [row.id, row.step]), [['codex/sol', 'hard-filter'], ['claude/sonnet', 'tokens']]);
  const text = pickRecordText(picked.record).join('\n');
  assert.match(text, /tier high: claude\/sonnet > codex\/sol > devin\/max/);
  assert.match(text, /dropped codex\/sol at hard-filter: capacity-full/);
  assert.match(text, /chosen devin\/max by tokens/);
});
