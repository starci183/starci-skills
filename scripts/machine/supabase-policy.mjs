// supabase-policy.mjs - the pure boundary for the port block owned by one local Supabase stack.

export const SUPABASE_PORT_NAMES = Object.freeze([
  'api',
  'db',
  'shadow',
  'studio',
  'inbucket',
  'analytics',
  'pooler',
]);

export const SUPABASE_PORT_MIN = 41000;
export const SUPABASE_PORT_MAX = 44999;

const integerPort = (value) => {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null;
  if (typeof value === 'string' && /^\d+$/u.test(value.trim())) return Number(value.trim());
  return null;
};

const entriesOf = (ports) => {
  if (Array.isArray(ports)) return SUPABASE_PORT_NAMES.map((name, index) => [name, ports[index]]);
  const source = ports && typeof ports === 'object' ? ports : {};
  const values = {
    api: source.api ?? source['api.port'],
    db: source.db ?? source['db.port'],
    shadow: source.shadow ?? source.shadow_port ?? source['db.shadow_port'],
    studio: source.studio ?? source['studio.port'],
    inbucket: source.inbucket ?? source['inbucket.port'],
    analytics: source.analytics ?? source['analytics.port'],
    pooler: source.pooler ?? source['db.pooler'] ?? source['db.pooler.port'],
  };
  return SUPABASE_PORT_NAMES.map((name) => [name, values[name]]);
};

const reservedRule = (port) => {
  if (port === 3100) return '3100 is never ours';
  if (port === 3000) return '3000 is never ours';
  if (port >= 54320 && port <= 54329) return '54320-54329 are never ours';
  if (port >= 55321 && port <= 55327) return '55321-55327 are never ours';
  return null;
};

/** Validate one app's seven configured ports. Returns only deterministic policy facts. */
export function checkPortBlock(ports) {
  const refusals = [];
  const seen = new Map();
  for (const [name, raw] of entriesOf(ports)) {
    const port = integerPort(raw);
    if (port == null) {
      refusals.push(`${name} port is missing or not an integer; every port must be inside ${SUPABASE_PORT_MIN}-${SUPABASE_PORT_MAX}`);
      continue;
    }
    const reserved = reservedRule(port);
    if (reserved) refusals.push(`${name} port ${port} is forbidden: ${reserved}`);
    else if (port < SUPABASE_PORT_MIN || port > SUPABASE_PORT_MAX) {
      refusals.push(`${name} port ${port} is outside the owned block; every port must be inside ${SUPABASE_PORT_MIN}-${SUPABASE_PORT_MAX}`);
    }
    seen.set(port, [...(seen.get(port) ?? []), name]);
  }
  for (const [port, names] of seen) {
    if (names.length > 1) refusals.push(`port ${port} is duplicated by ${names.join(', ')}; every port must be unique`);
  }
  return { ok: refusals.length === 0, refusals };
}
