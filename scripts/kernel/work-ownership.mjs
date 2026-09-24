// work-ownership.mjs — who owns a shared product Work record, which revision of it is committed, and
// what its owner declared about a change.
//
// Owner, 2026-09-25 (starci-next inc-1c7f7dad53e0): three workflows on one ledger (sn-foundation,
// sn-learn-content, sn-subscription) share Work records - challenges, commerce/br/single-subscription,
// the learning-paths foundation contract. Work-input staleness listed a settled job whenever a record
// it read changed from outside its workflow, so every peer rewrite re-staled settled work, the
// Kernels redid it, the redo rewrote records and re-staled the peers: sn-subscription redid its
// scope 5 times and its business seam 6. The versioned rollout that settled Source drift
// (2af07d02a) now reaches cross-workflow Work records:
//
//   ownership   every shared Work record has ONE owner workflow (ownerOf below). A settled job is
//               judged against the record revision it read; a peer's later change is advisory
//               `peerDrift`, never staleInput and never a redo.
//   breaking    only the record's OWNER turns a change into owed work: its committed change note
//               (`change: {rev, kind: breaking}` with a rev above the one the job read) or an
//               explicit `api record-change --record <path> --reach follow-up --reason <text>`. The
//               dependent job is then owed ONE targeted follow-up leg, never a seam-first cascade.
//   committed   only committed revisions count: an in-flight (uncommitted) rewrite of a record by
//               a leased job is never a change (committedReader below).
//
// Owner rule (ownerOf), the first that names a LIVE workflow (not finished, not archived):
//   1 foundation    a shared foundation's owner (scripts/kernel/foundations.mjs): a brand foundation
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
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { parseYaml } from '../../engine/yaml.mjs';
import { readFoundations } from './foundations.mjs';

export const RECORD_CHANGE_SCOPE = 'record-change';
export const RECORD_CHANGE_SCHEMA = 'starci/record-change@1';
export const RECORD_CHANGE_REACHES = Object.freeze(['follow-up', 'advisory']);
export const OWNER_SOURCES = Object.freeze(['foundation', 'scope-record', 'scope-node', 'cut', 'repo-owner']);
const WORK_PREFIX = '.starciwork/';
const REPO_OWNER_KINDS = ['baseline', 'scaffold', 'layout-tree', 'brand'];
const FOUNDATION_ROOTS = { brand: '.starciwork/brand', 'layout-tree': '.starciwork/shell' };
const READ_ONLY_NODE_KINDS = new Set(['foundation-dependency']);
const HISTORY_MAX = 20;

const parseJson = (text) => { try { return JSON.parse(text ?? 'null'); } catch { return null; } };
export const normWork = (p) => String(p ?? '').trim().replaceAll('\\', '/').replace(/^\.\/+/, '').replace(/\/+$/, '');
/** A record path as its directory: `<dir>/index.yaml` and `<dir>/resource.yaml` are the record at <dir>. */
export const recordDirOf = (p) => normWork(p).replace(/\/(?:index|resource)\.yaml$/, '');
const inside = (file, dir) => Boolean(dir) && (file === dir || file.startsWith(`${dir}/`));
const readYaml = (file) => { try { return parseYaml(fs.readFileSync(file, 'utf8')); } catch { return null; } };
const liveRow = (row) => Boolean(row) && row.phase !== 'finished' && row.archived_at == null;
const ownedOf = (payload) => (Array.isArray(payload?.owned_paths) ? payload.owned_paths : Array.isArray(payload?.ownedPaths) ? payload.ownedPaths : [])
  .filter((owned) => typeof owned === 'string' && owned.trim()).map(normWork);

/**
 * The owner resolver of one ledger and product repository. ownerOf(rel) for a `.starciwork/...`
 * path returns {workflowId, by, detail} (workflowId null only when the ledger has no live
 * workflow). Everything is read lazily and at most once per resolver.
 */
export function createOwnership(db, { repo = null, workDir = '.starciwork', foundations = null } = {}) {
  let workflows, found, scopes, cuts, repoOwner;
  const load = () => {
    if (workflows) return;
    workflows = new Map(db.prepare('SELECT workflow_id,phase,archived_at,created_at FROM workflows ORDER BY created_at,workflow_id').all()
      .map((row) => [row.workflow_id, row]));
    try { found = foundations ?? readFoundations(db); } catch { found = []; }
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
    for (const dir of [...dirs].sort()) {
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

const sha16 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
/** The digests a committed blob may show in a working tree: its bytes, and its bytes with CRLF line ends (core.autocrlf). */
export const committedDigestsOf = (buffer) => {
  if (!buffer) return [];
  const raw = sha16(buffer);
  const text = buffer.toString('latin1');
  const crlf = sha16(Buffer.from(text.replace(/\r?\n/g, '\r\n'), 'latin1'));
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
    const r = spawnSync('git', ['-C', repo, 'cat-file', '--batch'], { input, windowsHide: true, timeout: 60000, maxBuffer: 512 * 1024 * 1024 });
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

const declarationRowOf = (value) => { const record = parseJson(value); return record?.schema === RECORD_CHANGE_SCHEMA ? record : null; };
/** Every record's declarations: [{record, history:[{reach, reason, at, by, rev, digests}]}]. */
export const readRecordChanges = (db) => {
  try { return db.prepare('SELECT value_json FROM signals WHERE scope=? ORDER BY key').all(RECORD_CHANGE_SCOPE).map((row) => declarationRowOf(row.value_json)).filter(Boolean); }
  catch { return []; }
};
export const readRecordChange = (db, record) => declarationRowOf(db.prepare('SELECT value_json FROM signals WHERE scope=? AND key=?').get(RECORD_CHANGE_SCOPE, record)?.value_json);
export function writeRecordChange(db, { record, entry, now = Date.now() }) {
  const existing = readRecordChange(db, record);
  const value = { schema: RECORD_CHANGE_SCHEMA, record, history: [...(existing?.history ?? []), entry].slice(-HISTORY_MAX), updatedAt: now };
  db.prepare('INSERT OR REPLACE INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES(?,?,NULL,NULL,?,?,NULL)')
    .run(RECORD_CHANGE_SCOPE, record, JSON.stringify(value), now);
  return value;
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
