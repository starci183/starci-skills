// sonar-sequential.mjs - the Sonar Web API sequences that run one call after another, because a later call depends on how the
// earlier one answered: the token to try next, the page to ask for next, the condition the gate already holds. Each takes the
// transport (`call`) or the custody readers it needs, so this module reaches nothing of sonar-local.mjs.
import { findInOrder, repeatInOrder } from '../lib/in-order.mjs';

const PAGE = 500, MAX_PAGES = 40;

/** GET `pathname` with each token in turn; the answer of the first token the server does not refuse (401/403), else the last. */
export async function readWithTokens(call, cfg, tokens, pathname) {
  let answer;
  await findInOrder(tokens, async (token, index) => {
    const got = await call(cfg, 'GET', pathname, { token });
    if (index !== tokens.length - 1 && (got.status === 401 || got.status === 403)) return false;
    answer = got;
    return true;
  });
  return answer;
}

/** Every page of a paged Web API list, or {items, error, status} when a page cannot be read. */
export async function readPages(read, cfg, tokens, pathname, listKey) {
  const items = [];
  let failure = null;
  await repeatInOrder(async (tried) => {
    const page = tried + 1;
    if (page > MAX_PAGES) return true;
    const got = await read(cfg, tokens, `${pathname}${pathname.includes('?') ? '&' : '?'}ps=${PAGE}&p=${page}`);
    if (!got.reachable || got.status !== 200) {
      failure = { items, error: got.error ?? `HTTP ${got.status} ${got.text ?? ''}`.trim(), status: got.status };
      return true;
    }
    const batch = got.json?.[listKey] ?? [];
    items.push(...batch);
    const total = got.json?.paging?.total ?? got.json?.total ?? items.length;
    return !batch.length || items.length >= total ? true : undefined;
  });
  return failure ?? { items };
}

const written = (answer) => answer.status === 200 || answer.status === 201 || answer.status === 204;

/** Create or update the wanted gate conditions, then drop the ones not wanted; {changed} or {failed}. */
export async function syncConditions(call, { cfg, token, name, have, want, failed }) {
  const changed = [];
  let failure = null;
  await findInOrder(want, async (condition) => {
    const current = have.get(condition.metric);
    if (current?.op === condition.op && String(current.error) === condition.error) return false;
    const form = { metric: condition.metric, op: condition.op, error: condition.error };
    const answer = current
      ? await call(cfg, 'POST', '/api/qualitygates/update_condition', { token, form: { id: current.id, ...form } })
      : await call(cfg, 'POST', '/api/qualitygates/create_condition', { token, form: { gateName: name, ...form } });
    if (!written(answer)) { failure = { failed: failed(`condition ${condition.metric}`, answer) }; return true; }
    changed.push(condition.metric);
    return false;
  });
  if (failure) return failure;
  const wanted = new Set(want.map((condition) => condition.metric));
  await findInOrder(have.values(), async (current) => {
    if (wanted.has(current.metric)) return false;
    const answer = await call(cfg, 'POST', '/api/qualitygates/delete_condition', { token, form: { id: current.id } });
    if (answer.status !== 200 && answer.status !== 204) { failure = { failed: failed(`drop condition ${current.metric}`, answer) }; return true; }
    changed.push(`-${current.metric}`);
    return false;
  });
  return failure ?? { changed };
}

/**
 * Read the custody members in order and return the first the server accepts. A member it rejects is skipped and returned as
 * `stale` (the first one), so the caller re-mints over it.
 */
export async function acceptFirst({ cfg, refs, readCustody, tokenAccepted, remember }) {
  const misses = [];
  let stale = null;
  let hit = null;
  await findInOrder(refs, async (ref) => {
    const entry = readCustody(cfg, ref, { remember });
    if (!entry.present) {
      misses.push(entry.reason);
      if (!entry.identityRefusal) return false;
      hit = { entry: null, misses, stale, identityRefusal: entry.identityRefusal };
      return true;
    }
    const accepted = await tokenAccepted(cfg, entry.value);
    if (accepted !== false) { hit = { entry: { ...entry, accepted }, misses, stale }; return true; }
    stale ??= entry;
    misses.push(`${entry.name} is rejected by the server (stale custody)`);
    return false;
  });
  return hit ?? { entry: null, misses, stale };
}
