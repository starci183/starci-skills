// work-ownership.mjs — who owns a shared product Work record, which revision of it is committed, and
// what its owner declared about a change.
//
// Owner, 2026-09-25: three workflows on one ledger share Work records - challenges,
// commerce/br/single-subscription, the learning-paths foundation contract. Work-input staleness
// listed a settled job whenever a record
// it read changed from outside its workflow, so every peer rewrite re-staled settled work, the
// Kernels redid it, the redo rewrote records and re-staled the peers: one workflow redid its
// scope 5 times and its business seam 6. The versioned rollout that settled Source drift
// (2af07d02a) now reaches cross-workflow Work records:
//
//   ownership   every shared Work record has ONE owner workflow (ownerOf below). A settled job is
//               judged against the record revision it read; a peer's later change is advisory
//               `peerDrift`, never staleInput and never a redo.
//   breaking    only the record's OWNER turns a change into owed work: its committed change note
//               (`change: {rev, kind: breaking}` with a rev above the one the job read) or an
//               explicit `starci kernel record-change --record <path> --reach follow-up --reason <text>`. The
//               dependent job is then owed ONE targeted follow-up leg, never a seam-first cascade.
//   committed   only committed revisions count: an in-flight (uncommitted) rewrite of a record by
//               a leased job is never a change (committedReader below).
//
// Owner rule (ownerOf), the first that names a LIVE workflow (not finished, not archived):
//   0 transfer      the [Supervisor] transferred the record or a directory above it (scripts/supervisor/
//                   bridge.mjs transfer --record; signals scope ownership-transfer, provisional under autopilot)
//   1 foundation    a shared foundation's owner (scripts/kernel/foundation-registry.mjs): a brand foundation
//                   owns .starciwork/brand, a layout-tree .starciwork/shell, and any foundation owns
//                   the record directory named after it under a `foundation/` segment
//                   (features/commerce/contract/foundation/entitlement-contract).
//   2 scope-record  the feature directory the catalog (.starciwork/index.yaml features[].directory)
//                   places the record in, owned by the workflow its scope record names
//                   (<feature>/index.yaml extensions.work3.scope.request.workflow).
//   3 scope-node    the one workflow whose scope record names the record as a node it authors
//                   (a node of kind foundation-dependency only reads it).
//   4 cut           the one workflow whose op jobs (not cancelled) own a path covering it; with
//                   several scope-node candidates, the one of them whose jobs own it.
//   5 repo-owner    otherwise the ledger's repo owner: the live owner of its baseline, scaffold,
//                   layout-tree or brand foundation (in that order), else its oldest live workflow.
import fs from 'node:fs';
import path from 'node:path';
import { catFile } from '../api/git/cat-file.mjs';
import {sha256} from '../../engine/digest.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { readFoundations } from './foundation-registry.mjs';
import { parseJson } from '../lib/json.mjs';
import { normWork } from '../lib/path-key.mjs';
import { byCodeUnit } from '../lib/list.mjs';
import { recordRecordChange } from '../../engine/db/ledger.mjs';
import { workflowWorktreeOf } from '../machine/workflow-tree.mjs';

export const TRANSFER_SCHEMA = 'starci/ownership-transfer@1';
/** Every ownership transfer the Supervisor recorded ({path, to, from, reason, at, by, provisional, bridgeId}): path_transfers rows. */
export const readTransfers = (db) => db.prepare("SELECT detail_json FROM path_transfers WHERE state='applied' ORDER BY path").all()
  .map((row) => parseJson(row.detail_json)).filter((value) => value?.schema === TRANSFER_SCHEMA);
const RECORD_CHANGE_SCHEMA = 'starci/record-change@1';
export const RECORD_CHANGE_REACHES = Object.freeze(['follow-up', 'advisory']);
const WORK_PREFIX = '.starciwork/';
const REPO_OWNER_KINDS = ['baseline', 'scaffold', 'layout-tree', 'brand'];
const FOUNDATION_ROOTS = { brand: '.starciwork/brand', 'layout-tree': '.starciwork/shell' };
const READ_ONLY_NODE_KINDS = new Set(['foundation-dependency']);
const HISTORY_MAX = 20;

/** A record path as its directory: `<dir>/index.yaml` and `<dir>/resource.yaml` are the record at <dir>. */
const recordDirOf = (p) => normWork(p).replace(/\/(?:index|resource)\.yaml$/, '');
/** True when `file` is `dir` or sits under it. */
export const inside = (file, dir) => Boolean(dir) && (file === dir || file.startsWith(`${dir}/`));
const readYaml = (file) => { try { return parseYaml(fs.readFileSync(file, 'utf8')); } catch { return null; } };
const liveRow = (row) => Boolean(row) && row.phase !== 'finished' && row.archived_at == null;
/** A job payload's owned paths (owned_paths, else ownedPaths), normalized. */
export const ownedOf = (payload) => (Array.isArray(payload?.owned_paths) ? payload.owned_paths : Array.isArray(payload?.ownedPaths) ? payload.ownedPaths : [])
  .filter((owned) => typeof owned === 'string' && owned.trim()).map(normWork);

/**
 * The owner resolver of one ledger and product repository. ownerOf(rel) for a `.starciwork/...`
 * path returns {workflowId, by, detail} (workflowId null only when the ledger has no live
 * workflow). Everything is read lazily and at most once per resolver.
 */
export function createOwnership(db, { repo = null, workDir = '.starciwork', foundations = null } = {}) {
  let workflows, found, scopes, cuts, repoOwner, transfers;
  const load = () => {
    if (workflows) return;
    workflows = new Map(db.prepare('SELECT workflow_id,phase,archived_at,created_at FROM workflows ORDER BY created_at,workflow_id').all()
      .map((row) => [row.workflow_id, row]));
    try { found = foundations ?? readFoundations(db); } catch { found = []; }
    // Longest path first, so a transfer of a record wins over one of its parent directory.
    try { transfers = readTransfers(db).map((t) => ({ ...t, path: normWork(t.path) })).sort((a, b) => b.path.length - a.path.length); } catch { transfers = []; }
  };
  const live = (id) => { load(); return typeof id === 'string' && liveRow(workflows.get(id)); };
  const loadScopes = () => {
    if (scopes) return scopes;
    scopes = [];
    if (!repo) return scopes;
    const abs = path.join(repo, workDir);
    const dirs = new Set();
    for (const feature of readYaml(path.join(abs, 'index.yaml'))?.features ?? []) {
      if (typeof feature?.directory === 'string' && feature.directory.trim()) dirs.add(normWork(feature.directory));
    }
    try { for (const entry of fs.readdirSync(path.join(abs, 'features'), { withFileTypes: true })) if (entry.isDirectory()) dirs.add(`features/${entry.name}`); } catch { /* no features */ }
    for (const dir of [...dirs].sort(byCodeUnit)) {
      if (dir.includes('..')) continue;
      const scope = readYaml(path.join(abs, dir, 'index.yaml'))?.extensions?.work3?.scope;
      const workflowId = typeof scope?.request?.workflow === 'string' ? scope.request.workflow : null;
      const nodes = (Array.isArray(scope?.nodes) ? scope.nodes : [])
        .filter((node) => typeof node?.path === 'string' && node.path.startsWith(WORK_PREFIX) && !READ_ONLY_NODE_KINDS.has(node.kind))
        .map((node) => recordDirOf(node.path));
      scopes.push({ dir: `${WORK_PREFIX}${dir}`, workflowId, nodes });
    }
    return scopes;
  };
  const loadCuts = () => {
    if (cuts) return cuts;
    cuts = new Map();
    for (const row of db.prepare("SELECT workflow_id,payload_json FROM jobs WHERE kind='op' AND status<>'cancelled'").all()) {
      if (!live(row.workflow_id)) continue;
      const owned = ownedOf(parseJson(row.payload_json)).filter((p) => p.startsWith(WORK_PREFIX));
      if (!owned.length) continue;
      if (!cuts.has(row.workflow_id)) cuts.set(row.workflow_id, []);
      cuts.get(row.workflow_id).push(...owned);
    }
    return cuts;
  };
  const repoOwnerOf = () => {
    if (repoOwner !== undefined) return repoOwner;
    load();
    for (const kind of REPO_OWNER_KINDS) {
      const owner = found.find((f) => f.kind === kind && live(f.owner?.workflowId))?.owner?.workflowId;
      if (owner) return (repoOwner = { workflowId: owner, by: 'repo-owner', detail: `owner of the ${kind} foundation` });
    }
    const oldest = [...workflows.values()].find(liveRow);
    return (repoOwner = { workflowId: oldest?.workflow_id ?? null, by: 'repo-owner', detail: oldest ? 'oldest live workflow of the ledger' : 'no live workflow' });
  };
  const cache = new Map();
  const resolve = (rel) => {
    load();
    const file = normWork(rel);
    const segments = file.split('/');
    const moved = transfers.find((t) => inside(file, t.path) && live(t.to));
    if (moved) return { workflowId: moved.to, by: 'transfer', detail: `${moved.path} transferred${moved.from ? ` from ${moved.from}` : ''} by the Supervisor${moved.bridgeId ? ` (${moved.bridgeId})` : ''}` };
    for (const f of found) {
      if (!live(f.owner?.workflowId)) continue;
      const root = FOUNDATION_ROOTS[f.kind];
      if ((root && inside(file, root)) || segments.some((segment, i) => segment === f.name && segments[i - 1] === 'foundation')) {
        return { workflowId: f.owner.workflowId, by: 'foundation', detail: f.name };
      }
    }
    const all = loadScopes();
    const feature = all.find((scope) => inside(file, scope.dir));
    if (feature && live(feature.workflowId)) return { workflowId: feature.workflowId, by: 'scope-record', detail: feature.dir };
    const named = [...new Set(all.filter((scope) => live(scope.workflowId) && scope.nodes.some((node) => inside(file, node))).map((scope) => scope.workflowId))];
    if (named.length === 1) return { workflowId: named[0], by: 'scope-node', detail: all.find((scope) => scope.workflowId === named[0]).dir };
    const owning = [...loadCuts().entries()].filter(([id, owned]) => (!named.length || named.includes(id)) && owned.some((p) => inside(file, p))).map(([id]) => id);
    if (owning.length === 1) return { workflowId: owning[0], by: 'cut', detail: named.length ? `jobs own it among scope nodes of ${named.join(', ')}` : 'its jobs own it' };
    const fallback = repoOwnerOf();
    const why = named.length > 1 ? `scope nodes of ${named.join(', ')}` : owning.length > 1 ? `jobs of ${owning.join(', ')}` : null;
    return { ...fallback, detail: why ? `${fallback.detail}; ${why} all name it` : fallback.detail };
  };
  const ownerOf = (rel) => {
    const key = normWork(rel);
    if (!cache.has(key)) cache.set(key, resolve(key));
    return cache.get(key);
  };
  ownerOf.repoOwner = () => repoOwnerOf();
  ownerOf.live = live;
  return ownerOf;
}

const sha16 = (buffer) => sha256(buffer).slice(0, 16);
/** The digests a committed blob may show in a working tree: its bytes, and its bytes with CRLF line ends (core.autocrlf). */
const committedDigestsOf = (buffer) => {
  if (!buffer) return [];
  const raw = sha16(buffer);
  const text = buffer.toString('latin1');
  const crlf = sha16(Buffer.from(text.replaceAll(/\r?\n/g, '\r\n'), 'latin1'));
  const lf = sha16(Buffer.from(text.replace(/\r\n/g, '\n'), 'latin1'));
  return [...new Set([raw, crlf, lf])];
};
/** Does the committed blob (Buffer, or null when HEAD has no such file) show as this 16-hex digest (null: no file)? */
export const committedMatches = (buffer, digest) => (buffer ? committedDigestsOf(buffer).includes(digest ?? '') : digest == null);

/**
 * A reader of the committed (HEAD) bytes of `.starciwork/...` files in one product repository:
 * read(rels) -> Map rel -> Buffer | null (not at HEAD), or null when the repository is no git
 * checkout or HEAD tracks no Work directory (the caller then treats the working tree as
 * committed: there is no other revision). One `git cat-file --batch` per call; `HEAD:./<path>`
 * resolves against the checkout, wherever it sits in its git top level.
 */
export function committedReader(repo, { workDir = '.starciwork' } = {}) {
  const dir = normWork(workDir) || '.starciwork';
  return (rels) => {
    const wanted = [...new Set(rels.map(normWork))].filter((rel) => rel.startsWith(WORK_PREFIX) && !rel.includes('\n'));
    if (!repo) return null;
    const out = new Map();
    if (!wanted.length) return out;
    const input = `HEAD:./${dir}\n${wanted.map((rel) => `HEAD:./${dir}/${rel.slice(WORK_PREFIX.length)}`).join('\n')}\n`;
    const r = catFile(['--batch'], { dir: repo, input, encoding: null, timeout: 60000, maxBuffer: 512 * 1024 * 1024 });
    if (r.status !== 0 || !Buffer.isBuffer(r.stdout)) return null;
    const buf = r.stdout;
    let pos = 0;
    const next = () => {
      const eol = buf.indexOf(0x0a, pos);
      if (eol < 0) return undefined;
      const m = /^[0-9a-f]+ (\w+) (\d+)$/.exec(buf.subarray(pos, eol).toString('utf8'));
      pos = eol + 1;
      if (!m) return null;
      const size = Number(m[2]), body = { type: m[1], bytes: Buffer.from(buf.subarray(pos, pos + size)) };
      pos += size + 1;
      return body;
    };
    if (next()?.type !== 'tree') return null;
    for (const rel of wanted) {
      const body = next();
      if (body === undefined) break;
      out.set(rel, body?.type === 'blob' ? body.bytes : null);
    }
    return out;
  };
}

/**
 * The committed reader of workflow `workflowId` (WFWT2 2.8, the one rule for Work records): a record it owns (ownerOf) is
 * read at its own workflow branch - the HEAD of its live workflow worktree, where the runtime checkpoints its records -
 * so its later settles see its own records before it lands; every other record is read at the ledger checkout's HEAD
 * (main): a peer sees a record when its owner lands. Same contract as committedReader. `worktree`: the workflow
 * worktree's path (default: the registry's live one), null for none.
 */
export function workflowCommittedReader({ repo, workDir = '.starciwork', workflowId, ownerOf, worktree = workflowWorktreeOf({ env: process.env }, workflowId)?.path ?? null }) {
  const main = committedReader(repo, { workDir });
  if (!worktree || !workflowId) return main;
  const own = committedReader(worktree, { workDir });
  return (rels) => {
    const mine = rels.filter((rel) => ownerOf(rel)?.workflowId === workflowId);
    const a = own(mine), b = main(rels.filter((rel) => !mine.includes(rel)));
    return a === null || b === null ? null : new Map([...b, ...a]);
  };
}

/** The record's change note (`change: {rev, kind, at}`) read from its YAML text; null when it has none. */
export function changeNoteOf(text) {
  const lines = String(text ?? '').split(/\r?\n/);
  const start = lines.findIndex((line) => /^change:\s*$/.test(line));
  if (start < 0) return null;
  const note = {};
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break;
    const m = /^ {2}(rev|kind|at):\s*(.*?)\s*$/.exec(line);
    if (m && note[m[1]] === undefined) note[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  const rev = Number(note.rev);
  return { rev: Number.isInteger(rev) ? rev : null, kind: note.kind || null, at: note.at ? Date.parse(note.at) : null };
}

/* -------------------------------------------------------- owner declarations */

// record_changes: one row per declared change (append-only); `reason` holds the entry {reach, reason, at, by, rev, digests}
// as JSON text. A record's declaration is its newest HISTORY_MAX rows.
const historyOf = (rows) => rows.map((row) => parseJson(row.reason)).filter((e) => e && typeof e === 'object').slice(-HISTORY_MAX);
const declarationOf = (record, rows) => (rows.length ? { schema: RECORD_CHANGE_SCHEMA, record, history: historyOf(rows), updatedAt: rows.at(-1).at } : null);
/** Every record's declarations: [{record, history:[{reach, reason, at, by, rev, digests}]}]. */
export const readRecordChanges = (db) => {
  const byRecord = new Map();
  for (const row of db.prepare('SELECT record_id, reason, at FROM record_changes ORDER BY record_id, at, rowid').all()) {
    if (!byRecord.has(row.record_id)) byRecord.set(row.record_id, []);
    byRecord.get(row.record_id).push(row);
  }
  return [...byRecord].map(([record, rows]) => declarationOf(record, rows)).filter(Boolean);
};
export const readRecordChange = (db, record) => declarationOf(record, db.prepare('SELECT reason, at FROM record_changes WHERE record_id=? ORDER BY at, rowid').all(record));
export function writeRecordChange(db, { record, entry, now = Date.now() }) {
  recordRecordChange(db, { recordId: record, recordPath: record, workflowId: typeof entry?.by === 'string' ? entry.by : null,
    by: entry?.by ?? null, reason: entry, at: now });
  return readRecordChange(db, record);
}
/** The newest declaration covering `file` that `owner` made after `after`, or null. */
export function ownerDeclarationFor(changes, file, { owner, after }) {
  let best = null;
  for (const row of changes) {
    if (!inside(file, normWork(row.record))) continue;
    for (const entry of row.history ?? []) {
      if (entry?.by !== owner || !(Number(entry.at) > after)) continue;
      if (!best || entry.at > best.at) best = { ...entry, record: row.record };
    }
  }
  return best;
}
