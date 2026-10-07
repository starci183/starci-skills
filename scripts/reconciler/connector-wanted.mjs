// connector-wanted.mjs - whether the owner's config.yaml wants a connector service at all (the start-items serviceWanted
// rule): a connector off in config that does not answer is `unmanaged`, never an outage - no restart, no SERVICE_DOWN
// clock, no failStreak - and core-watch raises no fact for its row. An answering one stays healthy, an enabled one that
// is down still fails, and a config that cannot be read keeps the connector required (an outage still alerts).
import { serviceWanted } from './start-items.mjs';

/** Whether config.yaml wants the named connector service; an unreadable config keeps it required (an outage still alerts). */
export const connectorWanted = (name, config) => config == null || serviceWanted(name, config);

/**
 * A connector probe that honors the owner's config.yaml connectors: a connector serviceWanted says is off and that
 * does not answer is `unmanaged` (not an outage: no restart, no SERVICE_DOWN clock, no failStreak). An answering one
 * stays healthy, and a config that cannot be read keeps the plain probe (an outage still alerts).
 */
export const offInConfig = (name, probe, config) => async () => {
  const r = await probe();
  if (r?.ok === true) return r;
  let cfg;
  try { cfg = typeof config === 'function' ? config() : config; } catch { return r; }
  if (connectorWanted(name, cfg)) return r;
  return { ...r, ok: false, unmanaged: true, notRequired: true, error: 'off in config.yaml connectors (not required)' };
};
