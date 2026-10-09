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

const dependencyHold = detail => ({ code: 'workflow-purge-ledger-dependency', detail });

// Deletion custody is rooted at workflows and follows CASCADE only; archive custody is broader.
function purgeKeys(metadata, child, keys) {
  const parent = metadata.get(keys[0].table);
  if (!parent) throw new Error(`missing foreign-key parent ${keys[0].table}`);
  const ordered = [...keys].sort((a, b) => a.seq - b.seq);
  const primary = parent.columns.filter(column => column.pk > 0).sort((a, b) => a.pk - b.pk);
  const implicit = ordered.every(key => !key.to);
  if (implicit && primary.length !== ordered.length) throw new Error(`implicit parent key is incomplete: ${child} -> ${keys[0].table}`);
  return ordered.map((key, index) => {
    const to = implicit ? primary[index].name : key.to;
    if (!to || !parent.columns.some(column => column.name === to)
      || !metadata.get(child).columns.some(column => column.name === key.from))
      throw new Error(`unresolved foreign-key columns: ${child} -> ${keys[0].table}`);
    return { ...key, to };
  });
}

function purgeMatches(db, child, keys, parentIds) {
  const links = keys.map(key => `p.${quoted(key.to)}=c.${quoted(key.from)}`).join(' AND ');
  return prepareStored(db, `SELECT DISTINCT CAST(c.rowid AS TEXT) AS purge_row
    FROM ${quoted(child)} AS c JOIN ${quoted(keys[0].table)} AS p ON ${links}
    WHERE CAST(p.rowid AS TEXT) IN (SELECT value FROM json_each(?))
    ORDER BY CAST(c.rowid AS TEXT)`).all(JSON.stringify([...parentIds])).map(row => row.purge_row);
}

function purgeIdentity(db, listed, child, info) {
  // A future storage shape must gain an exact identity adapter before deletion is admitted.
  if (listed.get(child)?.wr || info.columns.some(column => ['rowid', '_rowid_', 'oid'].includes(column.name.toLowerCase())))
    throw new Error(`unsupported deletion row identity: ${child}`);
  prepareStored(db, `SELECT CAST(rowid AS TEXT) FROM ${quoted(child)} LIMIT 0`);
}

// Schema reachability is narrower than archive ownership: only CASCADE can delete a parent.
function cascadeTables(metadata) {
  const projected = new Set(['workflows']);
  let changed;
  do {
    changed = false;
    for (const [child, info] of metadata) {
      if (projected.has(child)) continue;
      const reachable = info.keys.some(keys => keys[0].on_delete === 'CASCADE' && projected.has(keys[0].table));
      if (!reachable) continue;
      projected.add(child);
      changed = true;
    }
  } while (changed);
  return projected;
}

function purgeEdges(db, metadata) {
  const listed = new Map(db.prepare('PRAGMA table_list').all().map(table => [table.name, table]));
  const projected = cascadeTables(metadata);
  purgeIdentity(db, listed, 'workflows', metadata.get('workflows'));
  return [...metadata].flatMap(([child, info]) => {
    const relevant = info.keys.filter(keys => projected.has(keys[0].table));
    if (!relevant.length) return [];
    purgeIdentity(db, listed, child, info);
    return relevant.map(keys => ({ child, keys: purgeKeys(metadata, child, keys) }));
  });
}

function cascadeEdge(db, deleted, { child, keys }) {
  const parents = deleted.get(keys[0].table);
  if (keys[0].on_delete !== 'CASCADE' || !parents.size) return false;
  let changed = false;
  for (const rowid of purgeMatches(db, child, keys, parents)) {
    if (deleted.get(child).has(rowid)) continue;
    deleted.get(child).add(rowid);
    changed = true;
  }
  return changed;
}

function purgeProjection(db, workflowId, metadata, edges) {
  const deleted = new Map([...metadata.keys()].map(table => [table, new Set()]));
  for (const row of prepareStored(db, 'SELECT CAST(rowid AS TEXT) AS purge_row FROM workflows WHERE workflow_id=?').all(workflowId))
    deleted.get('workflows').add(row.purge_row);
  let changed;
  do {
    changed = false;
    for (const edge of edges) {
      const expanded = cascadeEdge(db, deleted, edge);
      changed = expanded || changed;
    }
  } while (changed);
  return deleted;
}

function nullablePurgeKey(metadata, child, keys) {
  return keys.every(key => {
    const column = metadata.get(child).columns.find(item => item.name === key.from);
    return column && !column.notnull && !column.pk;
  });
}

function purgeEdgeDependencies(db, metadata, deleted, { child, keys }) {
  const action = keys[0].on_delete, parents = deleted.get(keys[0].table);
  if (!parents.size || action === 'CASCADE') return [];
  if (action === 'SET NULL' && nullablePurgeKey(metadata, child, keys)) return [];
  const matches = purgeMatches(db, child, keys, parents);
  if (!['RESTRICT', 'NO ACTION'].includes(action)) {
    return matches.length ? [dependencyHold(`${child} foreign key ${keys[0].id} -> ${keys[0].table} has unsupported deletion action ${action} for ${matches.length} row(s); ledger deletion remains held`)] : [];
  }
  // RESTRICT is immediate: a sibling cascade order is not evidence that it will succeed.
  const held = matches.filter(rowid => action === 'RESTRICT' || !deleted.get(child).has(rowid));
  return held.length ? [dependencyHold(`${child} foreign key ${keys[0].id} (${keys.map(key => key.from).join(', ')}) ${action} -> ${keys[0].table} retains ${held.length} row(s); ledger and host leftovers remain`)] : [];
}

/** Dependencies that native DELETE workflows cannot remove; read-only, including unsupported schema holds. */
export function workflowPurgeDependencies(db, workflowId) {
  try {
    const metadata = tableMetadata(db);
    if (!metadata.has('workflows')) throw new Error('workflow root table is missing');
    const edges = purgeEdges(db, metadata);
    const deleted = purgeProjection(db, workflowId, metadata, edges);
    return edges.flatMap(edge => purgeEdgeDependencies(db, metadata, deleted, edge));
  } catch (error) {
    return [dependencyHold(`deletion dependencies cannot be proven from the schema: ${String(error?.message ?? error).slice(0, 300)}; ledger and host leftovers remain`)];
  }
}
