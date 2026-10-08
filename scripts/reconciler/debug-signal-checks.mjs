// debug-signal-checks.mjs — the five questions of modules/reconciler/debug-questions.yaml that read a signal the runtime writes where the fact
// occurs (scripts/machine/debug-signals.mjs, the provider circuit transitions, the secret scan seam). Each check is pure over the snapshot and
// returns {state, evidence}: ok (the healthy answer), attention (a role departed), unknown (nothing on record to judge by). Evidence names
// ids, counts and rule names; it never carries the text of a secret.
import { LIVE_TOUCH } from './revision-swap.mjs';

const ok = (evidence) => ({ state: 'ok', evidence });
const attention = (evidence) => ({ state: 'attention', evidence });
const unknown = (evidence) => ({ state: 'unknown', evidence });
const verdictOf = (bad, evidence, good) => (bad ? attention(evidence) : ok(good ?? evidence));
const sum = (list) => list.reduce((total, n) => total + n, 0);
const unique = (list) => [...new Set(list)];
const attemptsOf = (snapshot) => snapshot.workflows.flatMap((w) => w.attempts ?? []);
const heldBy = (d, hold) => (d.workflows ?? []).flatMap((w) => w.held ?? []).filter((h) => h.hold === hold).length;
const minutes = (ms) => `${Math.max(1, Math.round(ms / 60_000))} min`;

// ------------------------------------------------------------------------------------------------ pl-network-loss

/** The provider outage episodes the circuit transitions name: [{provider, from, until, open, failureKind, jobId, step}]. A circuit ends at the end of its cooldown or at the next transition of the provider out of unavailable (a recovery, or a new strike on a circuit that had closed), whichever comes first. */
export function outageEpisodes(events, now) {
  const rows = [...events].sort((a, b) => a.seq - b.seq);
  return rows.filter((e) => e.to === 'unavailable').map((e) => {
    const closer = rows.find((x) => x.provider === e.provider && x.seq > e.seq && x.to !== 'unavailable');
    const ends = [closer?.at, e.circuitOpenUntil].filter((at) => Number.isFinite(at));
    const until = ends.length ? Math.min(...ends) : null;
    return { provider: e.provider, from: e.at, until, open: until === null || until > now, failureKind: e.failureKind, jobId: e.jobId, step: e.step };
  });
}

/** Whether an attempt of the provider was dispatched at or after `at`: the work resumed. */
const resumedAfter = (snapshot, provider, at) => attemptsOf(snapshot).some((a) => a.provider === provider && Number(a.dispatchedAt) >= at);

function providerReachability(d, snapshot, n) {
  const episodes = outageEpisodes(snapshot.providerEvents ?? [], snapshot.now);
  if (!episodes.length) return ok('no provider circuit opened on record: no provider outage stopped work');
  const closed = episodes.filter((e) => !e.open);
  const stuck = closed.filter((e) => snapshot.now - e.until > n.providerResumeMs && !resumedAfter(snapshot, e.provider, e.until) && heldBy(d, 'circuit-open') > 0);
  const resumed = closed.filter((e) => resumedAfter(snapshot, e.provider, e.until)).length;
  const text = `${episodes.length} provider outage(s): ${episodes.filter((e) => e.open).length} open, ${closed.length} closed (${resumed} followed by new work of that provider); `
    + episodes.slice(-3).map((e) => `${e.provider} ${e.failureKind ?? 'unknown'} at ${e.step ?? 'unknown step'} (${e.jobId ?? 'no job'})`).join('; ');
  return verdictOf(stuck.length > 0, `${stuck.length} circuit(s) closed over ${minutes(n.providerResumeMs)} ago while work is still held by circuit-open: ${stuck.map((e) => e.provider).join(', ')}; ${text}`, text);
}

// ------------------------------------------------------------------------------------------------ cu-live-state-untouched

const touchesOf = (change, previous) => {
  const listed = (change.applied ?? []).filter((a) => LIVE_TOUCH.includes(a.action)).map((a) => a.action);
  const schemaMoved = previous && JSON.stringify(previous.schemas ?? null) !== JSON.stringify(change.schemas ?? null) ? ['store-migrated'] : [];
  return unique([...listed, ...schemaMoved]);
};

function liveStateUntouched(d, snapshot) {
  const changes = snapshot.runtimeChanges ?? [];
  if (!changes.length) return unknown('no runtime-change-applied row on record yet: the engine writes one when it starts on a new revision and when a land re-looks at the running workflows');
  const touched = changes.map((c, i) => ({ c, touches: touchesOf(c, changes[i - 1]) })).filter((x) => x.touches.length);
  const count = (action) => sum(changes.flatMap((c) => (c.applied ?? []).filter((a) => a.action === action).map((a) => Number(a.count) || 0)));
  const text = `${changes.length} revision change(s) applied (${changes.filter((c) => c.cause === 'engine-start').length} engine start, ${changes.filter((c) => c.cause === 'land').length} land): `
    + `none closed, restarted or rewrote a terminal, ledger or product file; they released ${count('provider-receipts-released')} dead receipt(s), re-armed ${count('queue-rearmed')} queue key(s), looked at ${count('workflows-looked-at')} workflow(s) and rang ${count('kernel-doorbells-rung')} doorbell(s)`;
  const named = touched.map((x) => String(x.c.toRev ?? 'unknown').slice(0, 9) + ' ' + x.touches.join('+')).join('; ');
  return verdictOf(touched.length > 0, `${touched.length} revision change(s) touched live state: ${named}`, text);
}

// ------------------------------------------------------------------------------------------------ co-secret-in-transcript

function secretInTranscript(d, snapshot) {
  const scan = snapshot.secrets ?? { scanned: 0, unreadable: 0, hits: [] };
  if (!scan.scanned) return unknown(`no stored artifact was scanned (${scan.unreadable} unreadable)`);
  const where = unique(scan.hits.map((h) => `${h.artifact} (${h.rule})`));
  const text = `${scan.scanned} stored artifact(s) re-scanned with the redaction rules, ${scan.unreadable} unreadable`;
  return verdictOf(scan.hits.length > 0, `${where.length} stored artifact(s) hold a secret that survived redaction: ${where.slice(0, 8).join(', ')}; ${text}`, `${text}; none holds a secret`);
}

// ------------------------------------------------------------------------------------------------ rr-claimed-vs-observed

function claimedVsObserved(d, snapshot) {
  const rows = snapshot.hostDrift ?? [];
  if (!rows.length) return ok('no drift between the host and the ledger outlived its bound on record');
  const opened = rows.filter((r) => r.state === 'open');
  const standing = opened.filter((r) => !rows.some((c) => c.state === 'cleared' && c.entity === r.entity && c.code === r.code && c.seq > r.seq));
  const kinds = unique(opened.map((r) => r.driftKind));
  const text = `${opened.length} drift(s) outlived their bound (${kinds.join(', ')}); ${opened.length - standing.length} cleared`;
  const named = standing.slice(0, 6).map((r) => r.driftKind + ' ' + r.entity + ' (' + r.code + ')').join('; ');
  return verdictOf(standing.length > 0, `${standing.length} drift(s) standing past their bound: ${named}; ${text}`, text);
}

// ------------------------------------------------------------------------------------------------ cc-port-claims

/** The claims of one port in order: [{claimant, outcome, previous}] folded into {holder, doubled: [{first, second}], refused: [claimant]} (a grant while another claimant still holds it is a double claim). */
function foldPort(rows) {
  const state = { holder: null, doubled: [], refused: [], replaced: [] };
  for (const r of rows) {
    if (r.outcome === 'refused') state.refused.push(r.claimant);
    else if (r.outcome === 'replaced') { state.replaced.push({ claimant: r.claimant, previous: r.previous }); state.holder = null; }
    else if (r.outcome === 'released') { if (state.holder === r.claimant) state.holder = null; }
    else {
      if (state.holder && state.holder !== r.claimant) state.doubled.push({ first: state.holder, second: r.claimant });
      state.holder = r.claimant;
    }
  }
  return state;
}

function portClaims(d, snapshot) {
  const rows = snapshot.portClaims ?? [];
  if (!rows.length) return unknown('no port-claim row on record yet: `starci gate env-health serve` and `check --restart` write one for every claim');
  const ports = unique(rows.map((r) => r.port));
  const folds = ports.map((port) => ({ port, ...foldPort(rows.filter((r) => r.port === port)) }));
  const doubled = folds.flatMap((f) => f.doubled.map((x) => `${f.port}: ${x.first} and ${x.second}`));
  const takenFromOthers = folds.flatMap((f) => f.replaced.filter((x) => x.previous && x.previous !== x.claimant).map((x) => `${f.port}: ${x.claimant} stopped ${x.previous}`));
  const refused = sum(folds.map((f) => f.refused.length));
  const holders = folds.map((f) => f.port + ' held by ' + (f.holder ?? 'nobody')).join(', ');
  const text = `${rows.length} claim(s) on ${ports.length} port(s); ${refused} refused because a stranger held the port; ${holders}`;
  const bad = [...doubled.map((x) => `two claimants hold ${x}`), ...takenFromOthers.map((x) => `a live server was stopped for another claimant, ${x}`)];
  return verdictOf(bad.length > 0, `${bad.join('; ')}; ${text}`, text);
}

export const SIGNAL_CHECKS = Object.freeze({
  'provider-reachability': providerReachability,
  'live-state-untouched': liveStateUntouched,
  'secret-in-transcript': secretInTranscript,
  'claimed-vs-observed': claimedVsObserved,
  'port-claims': portClaims,
});
