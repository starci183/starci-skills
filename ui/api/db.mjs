import { openMachineObserver, machineFileFor } from '../../engine/db/machine.mjs';
import { openLedgerReader, ledgerIdOf } from '../../engine/db/ledger.mjs';

function openingFailure(error) {
  if (!error) return { availability: 'missing', code: 'DB_MISSING' };
  if (['STARCI_MACHINE_SCHEMA_OLD', 'STARCI_LEDGER_SCHEMA_REFUSED', 'STARCI_LEDGER_SQLITE_DOWNGRADE'].includes(error.code))
    return { availability: 'unsupported', code: 'SCHEMA_UNSUPPORTED' };
  if (error.code === 'ENOENT' || error.errcode === 14) return { availability: 'missing', code: 'DB_MISSING' };
  return { availability: 'unavailable', code: 'DB_UNAVAILABLE' };
}

/** The engine owns reader verification. Fanout never uses unverified SQLite opens. */
export function openUiDb({ env = process.env } = {}) {
  const file = env.STARCI_MACHINE_DB || machineFileFor(env);
  let machine = null, closed = false;
  const cached = new Map();
  function request() {
    const stale = new Set(), observations = new Map(), failedSources = new Map();
    let registry = null, machineRead = false;
    function observe(key, fields) {
      const previous = observations.get(key);
      // A later successful read cannot erase an earlier partial failure in this request.
      if (previous && previous.availability !== 'available' && fields.availability === 'available') return;
      observations.set(key, { ...fields, readAt: Date.now() });
      if (fields.availability !== 'available') stale.add(fields.name ?? key);
    }
    function machineOf() {
      if (!machineRead) {
        machineRead = true;
        try {
          if (!machine && !closed) machine = openMachineObserver({ file, env });
          observe('machine', machine ? { availability: 'available' } : openingFailure(null));
        } catch (error) { observe('machine', openingFailure(error)); }
      }
      return machine;
    }
    function projects() {
      if (registry) return registry;
      const reader = machineOf();
      if (!reader) return [];
      try { registry = reader.listLedgers({ state: 'active' }); return registry; }
      catch { observe('machine', { availability: 'unavailable', code: 'READ_FAILED' }); return []; }
    }
    function ledger(project) {
      const row = projects().find(item => item.name === project || item.ledgerId === project);
      if (!row) return null;
      const identity = { ledgerId: row.ledgerId, name: row.name };
      try {
        let entry = cached.get(row.ledgerId);
        if (entry && entry.file !== row.file) { entry.db.close(); cached.delete(row.ledgerId); entry = null; }
        if (!entry) {
          const db = openLedgerReader(row.file);
          if (ledgerIdOf({ db }) !== row.ledgerId) { db.close(); throw new Error('Registered ledger identity mismatch'); }
          entry = { file: row.file, db }; cached.set(row.ledgerId, entry);
        }
        observe(row.ledgerId, { ...identity, availability: 'available' });
        return { row, db: entry.db };
      } catch (error) { observe(row.ledgerId, { ...identity, ...openingFailure(error) }); return null; }
    }
    function forEachLedger(fn) {
      return projects().map(row => {
        const opened = ledger(row.ledgerId);
        if (!opened) return { ledger: row, error: 'DB_UNAVAILABLE' };
        try { return { ledger: row, result: fn(opened) }; }
        catch { observe(row.ledgerId, { ledgerId: row.ledgerId, name: row.name, availability: 'unavailable', code: 'READ_FAILED' });
          return { ledger: row, error: 'READ_FAILED' }; }
      });
    }
    function sourcesOf(sources = []) {
      const rows = registry ?? [];
      const enriched = sources.map(source => {
        const row = rows.find(item => item.ledgerId === source.ledgerId || item.ledgerId === source.db
          || (source.db !== 'machine' && item.name === source.db));
        const observation = observations.get(row?.ledgerId ?? source.db);
        const failure = failedSources.get(`${source.db}:${source.rel}`);
        if (!observation) return failure ? { ...source, ...failure } : source;
        return { ...observation, ...source,
          ...(observation.availability !== 'available' ? { availability: observation.availability, code: observation.code } : {}), ...failure };
      });
      for (const [key, observation] of observations) {
        if (observation.availability === 'available' || enriched.some(source => source.ledgerId === key || source.db === key
          || (source.db !== 'machine' && source.db === observation.name))) continue;
        enriched.push({ db: observation.name ?? key, rel: key === 'machine' ? 'machine_meta' : 'meta', ...observation });
      }
      for (const failure of failedSources.values()) if (!enriched.some(source => source.db === failure.db && source.rel === failure.rel)) enriched.push(failure);
      return enriched;
    }
    function failSource(db, rel) {
      const row = (registry ?? []).find(item => item.name === db || item.ledgerId === db);
      failedSources.set(`${db}:${rel}`, { db, rel, readAt: Date.now(), availability: 'unavailable', code: 'READ_FAILED',
        ...(row ? { ledgerId: row.ledgerId, name: row.name } : {}) });
      stale.add(row?.name ?? db);
    }
    function availability(project) {
      if (project === 'machine') { projects(); return observations.get('machine')?.availability; }
      const row = projects().find(item => item.name === project || item.ledgerId === project);
      return observations.get(row?.ledgerId ?? project)?.availability;
    }
    return { get machine() { return machineOf(); }, projects, ledger, forEachLedger, stale, sourcesOf, availability, failSource };
  }
  function close() {
    closed = true;
    for (const { db } of cached.values()) db.close();
    cached.clear(); machine?.close(); machine = null;
  }
  const initial = request();
  return { get machine() { return initial.machine; }, projects: initial.projects, ledger: initial.ledger,
    forEachLedger: initial.forEachLedger, stale: initial.stale, sourcesOf: initial.sourcesOf, request, close };
}
