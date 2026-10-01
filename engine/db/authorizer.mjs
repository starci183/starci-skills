// engine/db/authorizer.mjs — a write fence on one node:sqlite connection: SQLite's authorizer (DatabaseSync.setAuthorizer)
// refuses, at prepare time, every schema change and every write outside the tables the caller names. The log writer
// (scripts/machine/log-writer.mjs) fences its own ledger connection to the log tables this way.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/**
 * Fence `db`: CREATE TABLE/INDEX/TRIGGER/VIEW denied; INSERT and UPDATE only on `writable` tables; DELETE only on the
 * tables `deletable(table)` admits; every read allowed. False when this node:sqlite has no setAuthorizer (nothing fenced).
 */
export function guardWrites(db, { writable = [], deletable = () => false } = {}) {
  if (typeof db?.setAuthorizer !== 'function') return false;
  const { constants } = require('node:sqlite');
  const { SQLITE_OK, SQLITE_DENY, SQLITE_INSERT, SQLITE_UPDATE, SQLITE_DELETE, SQLITE_CREATE_TABLE, SQLITE_CREATE_INDEX, SQLITE_CREATE_TRIGGER, SQLITE_CREATE_VIEW } = constants;
  const writes = new Set([SQLITE_INSERT, SQLITE_UPDATE]);
  const creates = new Set([SQLITE_CREATE_TABLE, SQLITE_CREATE_INDEX, SQLITE_CREATE_TRIGGER, SQLITE_CREATE_VIEW]);
  db.setAuthorizer((action, table) => {
    if (creates.has(action)) return SQLITE_DENY;
    if (action === SQLITE_DELETE) return deletable(String(table)) ? SQLITE_OK : SQLITE_DENY;
    if (writes.has(action)) return writable.includes(String(table)) ? SQLITE_OK : SQLITE_DENY;
    return SQLITE_OK;
  });
  return true;
}
