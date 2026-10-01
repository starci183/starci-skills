import { openMachineReader, machineFileFor } from '../../engine/db/machine.mjs';
import { openLedgerReader } from '../../engine/db/ledger.mjs';

export function openUiDb({ env = process.env } = {}) {
  const file = env.STARCI_MACHINE_DB || machineFileFor(env);
  let machine = null;
  try { machine = openMachineReader({ file, env }); } catch { /* Health reports the unavailable database. */ }
  const cached = new Map();
  const stale = new Set();

  function projects() { return machine?.listLedgers({ state: 'active' }) ?? []; }
  function ledger(project) {
    const row = projects().find(item => item.name === project || item.ledgerId === project);
    if (!row) return null;
    if (cached.has(row.ledgerId)) return { row, db: cached.get(row.ledgerId) };
    try {
      const db = openLedgerReader(row.file);
      cached.set(row.ledgerId, db);
      stale.delete(row.name);
      return { row, db };
    } catch {
      stale.add(row.name);
      return null;
    }
  }
  function forEachLedger(fn) {
    if (!machine) return [];
    const results = machine.forEachLedger(({ ledger: row, db }) => fn({ row, db }));
    for (const result of results) {
      if (result.error) stale.add(result.ledger.name);
      else stale.delete(result.ledger.name);
    }
    return results;
  }
  function close() {
    for (const db of cached.values()) db.close();
    cached.clear();
    machine?.close();
  }
  return { machine, projects, ledger, forEachLedger, stale, close };
}
