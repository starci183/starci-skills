// workflow-archive-evidence.mjs — the exact workflow projection and its blob closure for native purge archives.
// The schema owns row custody (workflow_id or a foreign-key path to it), blob_ref_columns owns direct blob columns,
// ref-value owns stored content references, and blob.mjs owns bundle membership. No retention rule drops archive evidence.
import { artifactRoot, blobPath, blobReferences, getBlob, statBlob } from '../../engine/db/blob.mjs';
import { parseRef, prepareStored } from '../../engine/db/ref-value.mjs';

const quoted = (name) => `"${String(name).replaceAll('"', '""')}"`;

function tableMetadata(db) {
  return new Map(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name<>'workflow_purges' ORDER BY name").all().map(({ name }) => {
    const columns = db.prepare(`PRAGMA table_info(${quoted(name)})`).all();
    const keys = new Map();
    for (const key of db.prepare(`PRAGMA foreign_key_list(${quoted(name)})`).all()) {
      if (!keys.has(key.id)) keys.set(key.id, []);
      keys.get(key.id).push(key);
    }
    return [name, { columns, keys: [...keys.values()] }];
  }));
}

function scopeOf(table, metadata, seen = new Set()) {
  const info = metadata.get(table);
  if (!info || seen.has(table)) return null;
  if (info.columns.some((column) => column.name === 'workflow_id')) return `${quoted(table)}.workflow_id=:workflowId`;
  const visited = new Set([...seen, table]);
  const clauses = info.keys.flatMap((keys) => {
    const parent = keys[0].table, scope = scopeOf(parent, metadata, visited);
    if (!scope) return [];
    const links = keys.map((key) => `${quoted(parent)}.${quoted(key.to)}=${quoted(table)}.${quoted(key.from)}`).join(' AND ');
    return [`EXISTS (SELECT 1 FROM ${quoted(parent)} WHERE ${scope} AND ${links})`];
  });
  return clauses.length ? `(${clauses.join(' OR ')})` : null;
}

/** Every workflow-owned table and its exact stored rows, including foreign-key children without workflow_id. */
export function workflowArchiveRows(db, workflowId) {
  const metadata = tableMetadata(db), tables = new Map();
  for (const [table, info] of metadata) {
    const scope = scopeOf(table, metadata);
    if (!scope) continue;
    const rows = prepareStored(db, `SELECT * FROM ${quoted(table)} WHERE ${scope} ORDER BY rowid`).all({ workflowId });
    tables.set(table, { rows, columns: info.columns.map((column) => column.name) });
  }
  return tables;
}

function storedReferences(tables, shas) {
  for (const { rows } of tables.values()) {
    for (const row of rows) {
      for (const value of Object.values(row)) {
        const ref = parseRef(value);
        if (ref) shas.add(ref.sha);
      }
    }
  }
}

function referenceShas(db, tables) {
  const shas = new Set();
  for (const { table_name: table, column_name: column } of db.prepare('SELECT table_name, column_name FROM blob_ref_columns ORDER BY 1,2').all()) {
    const owned = tables.get(table);
    if (!owned?.columns.includes(column)) throw new Error(`incomplete workflow blob reference scope: ${table}.${column}; workflow rows remain`);
    for (const row of owned.rows) if (row[column] !== null) shas.add(row[column]);
  }
  storedReferences(tables, shas);
  return shas;
}

/** Verified original bytes of every declared/stored reference and recursive bundle member; missing or corrupt bytes refuse. */
export function workflowArchiveEvidence(db, workflowId, { root = artifactRoot(), tables = workflowArchiveRows(db, workflowId) } = {}) {
  const pending = referenceShas(db, tables), files = new Map();
  for (const sha of pending) {
    getBlob(sha, { root });
    const metadata = statBlob(sha, { root });
    files.set(sha, { rel: `blobs/${sha}`, abs: blobPath(sha, { root }), bytes: metadata.size, metadata });
    for (const member of blobReferences(sha, { root })) if (!files.has(member)) pending.add(member);
  }
  return { files: [...files.values()].sort((a, b) => a.rel.localeCompare(b.rel)), missing: [] };
}
