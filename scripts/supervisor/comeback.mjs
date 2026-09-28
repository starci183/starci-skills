#!/usr/bin/env node
// comeback.mjs — the clean-slate comeback (ARCHITECTURE-DB §6). It archives every old runtime store, verifies the
// archives, removes the stores, marks Work records whose evidence it archived as stale (Q12), creates fresh
// machine.sqlite / runtime.sqlite through the engine writers and prints the relaunch list, the rollback steps and the
// post-checks. It replaces the ev-backfill custody backfill: nothing old is migrated.
//
//   node scripts/supervisor/comeback.mjs [--json] [--date YYYYMMDD]            dry run (default): the full plan with sizes
//   node scripts/supervisor/comeback.mjs --apply [--json] [--date YYYYMMDD]    run it (owner go only; never by an agent)
//   node scripts/supervisor/comeback.mjs --post-check [--date YYYYMMDD]        re-run the §6.4 checks against the manifest
//
// Roots (for a scratch rehearsal under %TEMP%): --home, --local-app-data, --supervisor-home, --runtime-root,
// --repos-root, --lanes-root, --push-scratch-root, --archive-root, --repo <path> (repeatable: an extra managed repo).
//
// --apply refuses unless: every workflow is stopped (no live phase, no live kernel or op terminal), every controller
// is in shadow (or off), the engine holds no live leader lease, the engine writers expose the functions step 10 calls,
// and the archive disk has twice the stores' size free. Each step is recorded in
// <archive-root>/comeback-<date>/manifest.json and skipped when a re-run finds it done.
//
// Never touched: ~/.starci/prod.pw, ~/.starci/master.identity, any .starcistacks path, any *.key/*.age/*.identity/*.enc
// file (Q10). Directory trees are removed only through safe-remove.mjs (links are unlinked, never followed; never
// `git worktree remove --force`), and only after every file in them is in a verified archive.
import '../lib/hide-child-windows.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { gitResult } from '../lib/git.mjs';
import { slash, pathKey, samePath } from '../lib/path-key.mjs';
import { writeZip, readZip } from '../lib/zip-archive.mjs';
import { safeRemoveTree, safeRemoveWorktree, isLinkLike, unlinkOnly } from '../lib/safe-remove.mjs';
import { agentDataCategory, isProductPath, starciworkGitignoreText } from '../lib/starciwork-boundary.mjs';
import { openLedgerReader, hasLedgerTable } from '../../engine/ledger-db.mjs';

export const SCHEMA = 'starci/comeback-manifest@1';
const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DAY = 86_400_000;
const PART_MAX_ENTRIES = 60_000;
const PART_MAX_BYTES = 1024 ** 3;
const LIVE_PHASES = new Set(['awaiting-approval', 'queued', 'running']);
const DONE_PHASES = new Set(['stopped', 'finished', 'archived']);
const LIVE_JOB = new Set(['leased', 'running', 'answering']);
const FE_CANON = /-fe-canon-/;
const DROPPED_LEDGERS = ['starci-academy-backend']; // Q9: smoke ledgers are dropped, never relaunched
// alpha.3 stores a lane created before the comeback: archived and removed FIRST, so step 10 can create the fresh ones
// at the same paths before the evidence ingest.
const ALPHA3_KINDS = new Set(['machine-alpha3', 'project-ledger-alpha3']);

// ---------------------------------------------------------------------------------------------------------------
// roots and small helpers
// ---------------------------------------------------------------------------------------------------------------
export function rootsOf(opts = {}, env = process.env) {
  const home = path.resolve(opts.home ?? os.homedir());
  const localAppData = path.resolve(opts.localAppData ?? env.LOCALAPPDATA ?? path.join(home, 'AppData', 'Local'));
  const date = opts.date ?? new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const archiveRoot = path.resolve(opts.archiveRoot ?? 'D:/starci-archive');
  return {
    home, localAppData, date, archiveRoot,
    starciHome: path.join(home, '.starci'),
    supHome: path.resolve(opts.supervisorHome ?? env.STARCI_SUPERVISOR_HOME ?? path.join(home, '.starci', 'supervisor')),
    runtimeState: path.join(localAppData, 'StarCi', 'runtime'),
    starciLocal: path.join(localAppData, 'StarCi'),
    runtimeRoot: path.resolve(opts.runtimeRoot ?? SKILL_ROOT),
    reposRoot: path.resolve(opts.reposRoot ?? path.dirname(path.dirname(SKILL_ROOT))),
    lanesRoot: path.resolve(opts.lanesRoot ?? 'D:/starci-lanes'),
    pushScratchRoot: path.resolve(opts.pushScratchRoot ?? 'D:/.starci-tmp'),
    comebackDir: path.join(archiveRoot, `comeback-${date}`),
    extraRepos: (opts.repos ?? []).map((r) => path.resolve(r)),
  };
}

const exists = (p) => { try { fs.lstatSync(p); return true; } catch { return false; } };
const human = (n) => (n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(2)} GB` : n >= 1024 ** 2 ? `${(n / 1024 ** 2).toFixed(1)} MB` : n >= 1024 ? `${(n / 1024).toFixed(0)} KB` : `${n} B`);
const sha256File = (file) => { const h = crypto.createHash('sha256'); h.update(fs.readFileSync(file)); return h.digest('hex'); };
const sha256Of = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
/** A zip entry name that restores to exactly one absolute path: the drive letter becomes the first segment. */
export const entryNameOf = (abs) => slash(path.resolve(abs)).replace(/^([A-Za-z]):\//, '$1/').replace(/^\//, '');
export const absOfEntry = (name) => (/^[A-Za-z]\//.test(name) ? `${name[0]}:/${name.slice(2)}` : `/${name}`);

/** Q10 and the secret rules: a path the comeback never archives, reads or deletes. */
export function isSecretPath(abs, roots) {
  const p = pathKey(abs);
  if (samePath(p, pathKey(path.join(roots.starciHome, 'prod.pw'))) || samePath(p, pathKey(path.join(roots.starciHome, 'master.identity')))) return true;
  if (p.split('/').includes('.starcistacks')) return true;
  return /\.(key|age|identity|enc|pw)$/i.test(p) || /(^|\/)\.env(\.[^/]*)?$/i.test(p);
}

/** Every file under `root` without following a link: [{abs, size, mtimeMs}], plus the links and secrets it skipped. */
export function walkFiles(root, { roots, skipDir = () => false } = {}) {
  const out = { files: [], links: [], secrets: [], bytes: 0 };
  let st;
  try { st = fs.lstatSync(root); } catch { return out; }
  if (!st.isDirectory()) {
    if (st.isSymbolicLink()) out.links.push(root);
    else if (roots && isSecretPath(root, roots)) out.secrets.push(root);
    else { out.files.push({ abs: root, size: st.size, mtimeMs: st.mtimeMs }); out.bytes += st.size; }
    return out;
  }
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      let s;
      try { s = fs.lstatSync(abs); } catch { continue; }
      if (s.isSymbolicLink() || (s.isDirectory() && isLinkLike(abs, { stat: s }))) { out.links.push(abs); continue; }
      if (roots && isSecretPath(abs, roots)) { out.secrets.push(abs); continue; }
      if (s.isDirectory()) { if (!skipDir(abs, e.name)) stack.push(abs); continue; }
      if (s.isFile()) { out.files.push({ abs, size: s.size, mtimeMs: s.mtimeMs }); out.bytes += s.size; }
    }
  }
  out.files.sort((a, b) => (a.abs < b.abs ? -1 : a.abs > b.abs ? 1 : 0));
  return out;
}

const readOnly = (file, fn, fallback = null) => {
  if (!exists(file)) return fallback;
  let db;
  // The old stores are pre-alpha.3 schemas: read them raw (verify:false), never through the writer's schema check.
  try { db = openLedgerReader(file, { verify: false }); return fn(db); } catch (error) { return { error: String(error?.message ?? error) }; } finally { try { db?.close(); } catch { /* closed */ } }
};
const tablesOf = (db) => db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map((r) => r.name);
const columnsOf = (db, table) => db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);

// ---------------------------------------------------------------------------------------------------------------
// discovery
// ---------------------------------------------------------------------------------------------------------------
/** The old machine registry's ledgers ({ledgerId, file, repo}); [] when it cannot be read. */
export function oldLedgers(roots) {
  const rows = readOnly(path.join(roots.runtimeState, 'machine.sqlite'), (db) => (hasLedgerTable(db, 'ledgers') ? db.prepare('SELECT * FROM ledgers').all() : []), []);
  return Array.isArray(rows) ? rows.map((r) => ({ ledgerId: r.ledger_id, file: path.resolve(r.file), repo: path.dirname(path.dirname(path.resolve(r.file))) })) : [];
}

/**
 * The managed repositories: every repo whose ledger the old registry enrols, every repo holding a
 * .starciwork/runtime.sqlite under the repositories root, the sibling repositories their workspace.yaml binds (the
 * FE repo holds op worktrees) and every --repo. A .starciwork the runtime never enrolled is reported, not touched.
 */
export function managedRepos(roots, ledgers = oldLedgers(roots)) {
  const repos = new Map();
  const add = (repo, why) => { const k = pathKey(repo); if (!repos.has(k) && exists(repo)) repos.set(k, { repo: path.resolve(repo), name: path.basename(repo), why }); };
  for (const l of ledgers) add(l.repo, 'registered ledger');
  let entries = [];
  try { entries = fs.readdirSync(roots.reposRoot, { withFileTypes: true }).filter((e) => e.isDirectory()); } catch { /* no root */ }
  const unmanaged = [];
  for (const e of entries) {
    const work = path.join(roots.reposRoot, e.name, '.starciwork');
    if (!exists(work)) continue;
    if (exists(path.join(work, 'runtime.sqlite'))) add(path.join(roots.reposRoot, e.name), 'ledger file');
  }
  for (const { repo } of [...repos.values()]) {
    let text = '';
    try { text = fs.readFileSync(path.join(repo, '.starciwork', 'workspace.yaml'), 'utf8'); } catch { continue; }
    for (const m of text.matchAll(/^\s*(?:-\s*)?name:\s*([A-Za-z0-9._-]+)\s*$/gm)) add(path.join(path.dirname(repo), m[1]), `bound by ${path.basename(repo)}/.starciwork/workspace.yaml`);
  }
  for (const r of roots.extraRepos) add(r, '--repo');
  for (const e of entries) {
    const repo = path.join(roots.reposRoot, e.name);
    if (exists(path.join(repo, '.starciwork')) && !repos.has(pathKey(repo))) unmanaged.push(repo);
  }
  return { repos: [...repos.values()], unmanaged };
}

/** Every old SQLite store: [{label, kind, files: [abs...]}]. */
export function oldDatabases(roots, repos) {
  const dbs = [];
  const group = (label, kind, dir, pattern) => {
    let names = [];
    try { names = fs.readdirSync(dir).filter((n) => pattern.test(n)); } catch { return; }
    if (names.length) dbs.push({ label, kind, main: path.join(dir, names.find((n) => !/-(wal|shm)$/.test(n)) ?? names[0]), files: names.sort().map((n) => path.join(dir, n)) });
  };
  for (const { repo, name } of repos) {
    const work = path.join(repo, '.starciwork');
    group(`${name} ledger`, 'project-ledger', work, /^runtime\.sqlite(-wal|-shm)?$/);
    let names = [];
    try { names = fs.readdirSync(work).filter((n) => /^logs\.sqlite/.test(n)); } catch { /* none */ }
    const bases = [...new Set(names.map((n) => n.replace(/-(wal|shm)$/, '')))];
    for (const base of bases) group(`${name} ${base}`, 'logs-db', work, new RegExp(`^${base.replace(/[.]/g, '\\.')}(-wal|-shm)?$`));
  }
  group('supervisor ledger', 'supervisor-ledger', path.join(roots.supHome, '.starciwork'), /^runtime\.sqlite(-wal|-shm)?$/);
  group('reconciler.sqlite', 'reconciler', roots.supHome, /^reconciler\.sqlite(-wal|-shm)?$/);
  group('journal.sqlite', 'journal', roots.runtimeState, /^journal\.sqlite(-wal|-shm)?$/);
  group('machine.sqlite', 'machine', roots.runtimeState, /^machine\.sqlite(-wal|-shm)?$/);
  // alpha.3 stores created before the comeback (a lane's run, a spec leak): archived and recreated fresh in step 10.
  // The new-schema machine.sqlite (a3-2) already holds live land runs: KEPT when it validates (user_version 1, the
  // 0001-init tables, quick_check ok); only an invalid one is archived and recreated.
  const newMachine = path.join(roots.starciLocal, 'machine.sqlite');
  if (exists(newMachine) && !validateNewMachine(newMachine).ok) group('machine.sqlite (alpha.3, INVALID - recreated)', 'machine-alpha3', roots.starciLocal, /^machine\.sqlite(-wal|-shm)?$/);
  let projects = [];
  try { projects = fs.readdirSync(path.join(roots.starciLocal, 'projects')); } catch { /* none */ }
  for (const id of projects) group(`projects/${id} ledger (alpha.3, pre-comeback)`, 'project-ledger-alpha3', path.join(roots.starciLocal, 'projects', id), /^runtime\.sqlite(-wal|-shm)?$/);
  let baks = [];
  try { baks = fs.readdirSync(roots.runtimeState).filter((n) => /^machine\.sqlite\..*bak/.test(n)); } catch { /* none */ }
  for (const b of baks) dbs.push({ label: b, kind: 'machine-backup', main: path.join(roots.runtimeState, b), files: [path.join(roots.runtimeState, b)] });
  for (const d of dbs) d.bytes = d.files.reduce((s, f) => s + (fs.statSync(f).size || 0), 0);
  return dbs;
}

/** The alpha.3 machine.sqlite check: user_version 1, exactly the 0001-init tables, quick_check ok. Read-only. */
export function validateNewMachine(file) {
  let init = '';
  try { init = fs.readFileSync(path.join(SKILL_ROOT, 'engine', 'migrations', 'machine', '0001-init.sql'), 'utf8'); } catch { return { ok: false, file, why: 'engine/migrations/machine/0001-init.sql not found' }; }
  const want = new Set([...init.matchAll(/CREATE (?:VIRTUAL )?TABLE IF NOT EXISTS ([A-Za-z0-9_]+)/g)].map((m) => m[1]));
  const fts = [...init.matchAll(/CREATE VIRTUAL TABLE IF NOT EXISTS ([A-Za-z0-9_]+)/g)].map((m) => m[1]);
  const r = readOnly(file, (db) => ({ version: db.prepare('PRAGMA user_version').get().user_version, tables: tablesOf(db), check: db.prepare('PRAGMA quick_check').get()?.quick_check }), null);
  if (!r || r.error) return { ok: false, file, why: r?.error ?? 'unreadable' };
  const have = new Set(r.tables.filter((t) => !fts.some((f) => t.startsWith(`${f}_`))));
  const missing = [...want].filter((t) => !have.has(t)), extra = [...have].filter((t) => !want.has(t));
  const why = [r.version !== 1 ? `user_version ${r.version}` : null, missing.length ? `missing ${missing.slice(0, 5).join(',')}` : null,
    extra.length ? `extra ${extra.slice(0, 5).join(',')}` : null, r.check !== 'ok' ? `quick_check ${r.check}` : null].filter(Boolean);
  return { ok: why.length === 0, file, tables: have.size, why: why.join('; ') || null };
}

/** Row counts per table and a quick_check of one old DB, read-only (the manifest keeps them for the audit). */
export function dbFacts(file) {
  return readOnly(file, (db) => {
    const counts = {};
    for (const t of tablesOf(db)) { try { counts[t] = db.prepare(`SELECT count(*) AS n FROM "${t}"`).get().n; } catch { counts[t] = null; } }
    let check = null;
    try { check = db.prepare('PRAGMA quick_check').get()?.quick_check ?? null; } catch (error) { check = String(error?.message ?? error); }
    return { counts, quickCheck: check };
  }, { counts: {}, quickCheck: 'missing' });
}

/** The JSON state files and the text logs (§3.2, §3.3): [{label, group: 'state'|'logs', path, keep?}]. */
export function oldStateAndLogs(roots) {
  const rt = roots.runtimeState, sup = roots.supHome, guards = path.join(roots.runtimeRoot, 'runtime', 'guards');
  const out = [];
  const labelOf = (p) => { const rel = slash(path.relative(roots.home, p)); return rel.startsWith('..') || path.isAbsolute(rel) || /^[A-Za-z]:/.test(rel) ? slash(p) : `~/${rel}`; };
  const add = (group, p) => { if (exists(p)) out.push({ group, path: p, label: labelOf(p) }); };
  // state. The whole old %LOCALAPPDATA%/StarCi/runtime/ (a3-2): ram-throttle.json, connectors/ (locks, *.starting.json,
  // gateway/tunnel/telegram JSON, sent stores, supervisors/ inbox/outbox), env-servers/, uat-slots/, candidates/, deps/,
  // reconciler.log, watchdog-logs/ and the old machine/journal DBs - all replaced by machine.sqlite rows (connectors incl.
  // the supervisor-channel registry, host_locks incl. UAT slot holders, uat_slots, env_servers, notifications,
  // sup_messages, machine_logs). Live connector configuration is at %LOCALAPPDATA%/StarCi/cloudflared/ and is not touched.
  add('state', rt);
  add('state', path.join(roots.localAppData, 'StarCi', 'runtime-v6'));
  add('state', path.join(roots.localAppData, 'StarCi', 'archive'));
  for (const n of ['gc-state.json', 'reconciler.heartbeat', 'reconciler-starts.json']) add('state', path.join(sup, n));
  for (const d of ['land', 'staging']) add('state', path.join(sup, d));
  for (const d of ['handoff', 'redundancy', 'lanes', 'backups']) add('state', path.join(roots.starciHome, d));
  for (const n of ['jobs', 'terminals', 'refusals.jsonl', 'footprint.json', 'footprint.jsonl', 'footprint.claim', 'host-resources.json']) add('state', path.join(guards, n));
  // logs
  add('logs', path.join(sup, 'logs'));
  let lane = [];
  try { lane = fs.readdirSync(roots.lanesRoot, { withFileTypes: true }).filter((e) => e.isFile() && /-land\d*\.(json|err|log)$/.test(e.name)); } catch { /* none */ }
  for (const e of lane) add('logs', path.join(roots.lanesRoot, e.name));
  return out;
}

/**
 * The agent data in one repository's .starciwork (§5.2): the maximal trees and files agentDataCategory names, minus
 * the ledger / logs files (oldDatabases) and worktrees/ (handled as worktrees). Drift (neither agent data nor §5.1)
 * is counted and kept.
 */
export function starciworkAgentData(repo) {
  const work = path.join(repo, '.starciwork');
  const units = [], drift = [];
  let productFiles = 0;
  if (!exists(work)) return { units, drift, productFiles };
  const walk = (rel) => {
    let entries;
    try { entries = fs.readdirSync(path.join(work, rel), { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      const abs = path.join(work, r);
      const linkish = e.isSymbolicLink() || (e.isDirectory() && isLinkLike(abs));
      const cat = agentDataCategory(r, { dir: e.isDirectory() && !linkish });
      if (cat === 'ledger' || cat === 'logs-db' || cat === 'worktrees') continue;
      if (cat) { units.push({ rel: r, abs, category: cat, dir: e.isDirectory() && !linkish, link: linkish }); continue; }
      if (e.isDirectory() && !linkish) walk(r);
      else if (isProductPath(r)) productFiles += 1;
      else drift.push(r);
    }
  };
  walk('');
  return { units, drift, productFiles };
}

/** Every linked worktree of the managed repositories, and leftover worktree directories no git registry lists. */
export function opWorktrees(roots, repos, { keepWorkflows = [] } = {}) {
  const keepTags = keepWorkflows.map((wf) => wf.split('-').at(-1)).filter(Boolean);
  // Op worktrees live ONLY at <repo>/.starciwork/worktrees/ (today) or D:/starci-wt/ (§5.2 target), and push-mains
  // scratches at <push-scratch-root>/starci-push-*; every other linked worktree belongs to someone else.
  const owned = [...repos.map((r) => path.join(r.repo, '.starciwork', 'worktrees')), 'D:/starci-wt'].map(pathKey);
  const runtimeOwned = (abs) => { const k = pathKey(abs); return owned.some((o) => k.startsWith(`${o}/`)) || k.startsWith(`${pathKey(roots.pushScratchRoot)}/starci-push-`); };
  const out = [];
  const seen = new Set();
  for (const { repo, name } of repos) {
    const r = gitResult(['worktree', 'list', '--porcelain'], { dir: repo });
    if (!r.ok) continue;
    const main = gitResult(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], { dir: repo });
    const base = main.ok ? main.stdout.trim() : 'main';
    for (const block of r.stdout.split(/\r?\n\r?\n/).slice(1)) {
      const wt = /^worktree (.+)$/m.exec(block)?.[1]; if (!wt) continue;
      const head = /^HEAD ([0-9a-f]+)$/m.exec(block)?.[1] ?? null;
      const branch = /^branch refs\/heads\/(.+)$/m.exec(block)?.[1] ?? null;
      const abs = path.resolve(wt);
      seen.add(pathKey(abs));
      if (!runtimeOwned(abs)) continue; // a person's own checkout (a Codex/Claude session, a sibling clone) is never touched
      const status = gitResult(['status', '--porcelain', '--untracked-files=normal'], { dir: abs });
      const ahead = head ? gitResult(['rev-list', '--count', `${base}..${head}`], { dir: repo }) : { ok: false };
      const pushScratch = pathKey(abs).startsWith(`${pathKey(roots.pushScratchRoot)}/starci-push-`);
      const kept = keepTags.find((t) => slash(abs).includes(`/${t}/`) || slash(abs).endsWith(`/${t}`) || branch?.endsWith(t));
      out.push({ repo, repoName: name, path: abs, head, branch, base, exists: exists(abs), prunable: /^prunable/m.test(block),
        dirty: status.ok ? status.stdout.split(/\r?\n/).filter(Boolean).length : null,
        unlanded: ahead.ok ? Number(ahead.stdout.trim()) : null,
        scratchDir: pushScratch ? path.dirname(abs) : null,
        keep: kept ? `workflow ${keepWorkflows.find((wf) => wf.endsWith(kept))} finishes outside the harness (Q8)` : null });
    }
    const dir = path.join(repo, '.starciwork', 'worktrees');
    if (exists(dir)) {
      for (const wf of fs.readdirSync(dir)) {
        for (const op of (() => { try { return fs.readdirSync(path.join(dir, wf)); } catch { return []; } })()) {
          const abs = path.join(dir, wf, op);
          if (seen.has(pathKey(abs))) continue;
          const kept = keepTags.includes(wf);
          out.push({ repo, repoName: name, path: abs, head: null, branch: null, leftover: true, exists: true, dirty: null, unlanded: null,
            keep: kept ? 'workflow finishes outside the harness (Q8)' : null });
        }
      }
    }
  }
  // Push scratches whose worktree registration is already gone.
  let scratches = [];
  try { scratches = fs.readdirSync(roots.pushScratchRoot).filter((n) => n.startsWith('starci-push-')); } catch { /* none */ }
  for (const n of scratches) {
    const abs = path.join(roots.pushScratchRoot, n);
    if (!out.some((w) => w.scratchDir && samePath(pathKey(w.scratchDir), pathKey(abs)))) out.push({ repo: null, repoName: null, path: abs, leftover: true, scratchDir: abs, exists: true });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// preconditions and relaunch
// ---------------------------------------------------------------------------------------------------------------
/** Workflows of one ledger with their phase, latest goal and live jobs (read-only). */
export function workflowsOf(file) {
  const rows = readOnly(file, (db) => {
    if (!hasLedgerTable(db, 'workflows')) return [];
    const cols = new Set(columnsOf(db, 'workflows'));
    const goals = hasLedgerTable(db, 'goals');
    const jobs = hasLedgerTable(db, 'jobs') && columnsOf(db, 'jobs').includes('status');
    return db.prepare('SELECT * FROM workflows').all().map((w) => {
      const goal = goals ? db.prepare('SELECT * FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1').get(w.workflow_id) : null;
      const live = jobs ? db.prepare(`SELECT count(*) AS n FROM jobs WHERE workflow_id=? AND status IN (${[...LIVE_JOB].map(() => '?').join(',')})`).get(w.workflow_id, ...LIVE_JOB).n : 0;
      return { workflowId: w.workflow_id, title: w.title ?? null, displayName: cols.has('display_name') ? w.display_name : null, phase: w.phase ?? null,
        archivedAt: w.archived_at ?? null, sourceRoots: w.source_roots_json ?? null, liveJobs: live,
        goal: goal ? { revision: goal.revision, markdown: goal.markdown, json: goal.json, createdAt: goal.created_at } : null };
    });
  }, []);
  return Array.isArray(rows) ? rows : [];
}

const kernelTerminals = (file) => {
  const rows = readOnly(file, (db) => (hasLedgerTable(db, 'signals') ? db.prepare("SELECT key, value_json FROM signals WHERE scope='kernel'").all() : []), []);
  return (Array.isArray(rows) ? rows : []).map((r) => { try { return { workflowId: r.key, terminal: JSON.parse(r.value_json)?.terminal ?? null }; } catch { return { workflowId: r.key, terminal: null }; } });
};

/** Controller modes and the engine leader: {modes: [{controller, mode}], leader, engineLive}. */
export function engineFacts(roots, { now = Date.now(), pidAlive = defaultPidAlive } = {}) {
  const machineFile = path.join(roots.starciLocal, 'machine.sqlite');
  const newModes = readOnly(machineFile, (db) => (hasLedgerTable(db, 'controller_modes') ? db.prepare('SELECT controller, mode FROM controller_modes').all() : null), null);
  const old = readOnly(path.join(roots.supHome, 'reconciler.sqlite'), (db) => ({
    modes: hasLedgerTable(db, 'modes') ? db.prepare('SELECT controller, mode FROM modes').all() : [],
    leader: hasLedgerTable(db, 'leader') ? db.prepare('SELECT * FROM leader').get() ?? null : null }), { modes: [], leader: null });
  const newLeader = readOnly(machineFile, (db) => (hasLedgerTable(db, 'engine_leader') ? db.prepare('SELECT * FROM engine_leader').get() ?? null : null), null);
  const modes = Array.isArray(newModes) && newModes.length ? newModes : old?.modes ?? [];
  const leader = (newLeader && !newLeader.error ? newLeader : null) ?? old?.leader ?? null;
  const engineLive = Boolean(leader && Number(leader.expires_at) > now && (!leader.pid || pidAlive(Number(leader.pid))));
  return { modes: modes.map((m) => ({ controller: m.controller, mode: m.mode })), leader: leader ? { pid: leader.pid ?? null, expiresAt: leader.expires_at ?? null, holder: leader.holder ?? null } : null, engineLive };
}
function defaultPidAlive(pid) { if (!pid) return false; try { process.kill(pid, 0); return true; } catch (e) { return e?.code === 'EPERM'; } }

/** The Orca terminals open right now: {ok, handles:Set, titles:[...]}; ok false when Orca did not answer. */
async function liveTerminals() {
  try {
    const { terminalList } = await import('../api/orca/terminal-list.mjs');
    const r = terminalList({ includeVisualLayouts: true });
    if (!r.ok) return { ok: false, error: r.error ?? 'Orca did not answer', handles: new Set(), titles: [] };
    const titles = (r.visualLayouts ?? []).flatMap((l) => JSON.stringify(l).match(/\[(Kernel|Op|Worker|Supervisor)\][^"]*/g) ?? []);
    return { ok: true, handles: new Set((r.terminals ?? []).map((t) => t.handle ?? t.terminal ?? t.id).filter(Boolean)), titles };
  } catch (error) { return { ok: false, error: String(error?.message ?? error), handles: new Set(), titles: [] }; }
}

/** The §6.1 preconditions. Each blocker is a sentence; apply refuses while any stands. */
export async function preconditions(plan, { terminals = null, now = Date.now(), pidAlive = defaultPidAlive, requireWriters = true, writers = null } = {}) {
  const blockers = [], notes = [];
  const live = terminals ?? await liveTerminals();
  if (!live.ok) blockers.push(`Orca did not answer the terminal list (${live.error}): cannot prove no kernel or op terminal is alive`);
  for (const l of plan.ledgers) {
    const kernels = kernelTerminals(l.file);
    for (const wf of l.workflows) {
      const k = kernels.find((x) => x.workflowId === wf.workflowId);
      const alive = k?.terminal && live.handles.has(k.terminal);
      if (DONE_PHASES.has(wf.phase)) continue;
      if (alive) blockers.push(`${l.name}: ${wf.workflowId} still has a live kernel terminal ${k.terminal}`);
      else if (wf.phase === 'paused') notes.push(`${l.name}: ${wf.workflowId} is paused (no live kernel)`);
      else if (LIVE_PHASES.has(wf.phase)) notes.push(`${l.name}: ${wf.workflowId} phase ${wf.phase} in the old schema, no live kernel terminal: counted as stopped`);
    }
  }
  if (live.titles?.some((t) => /^\[(Kernel|Op|Worker)\]/.test(t))) blockers.push(`live runtime terminals: ${live.titles.filter((t) => /^\[(Kernel|Op|Worker)\]/.test(t)).slice(0, 5).join(', ')}`);
  const eng = engineFacts(plan.roots, { now, pidAlive });
  const notShadow = eng.modes.filter((m) => !['shadow', 'off'].includes(m.mode));
  if (!eng.modes.length) notes.push('no controller mode is recorded (engine never ran here)');
  if (notShadow.length) blockers.push(`controllers not in shadow: ${notShadow.map((m) => `${m.controller}=${m.mode}`).join(', ')}`);
  if (eng.engineLive) blockers.push(`the reconciler engine holds a live leader lease (pid ${eng.leader?.pid}): end it and disable the StarCi-Reconciler task first (§6.2 step 2)`);
  if (requireWriters) { const w = writers ?? await writersReady(); if (!w.ok) blockers.push(`the fresh-DB writers are not landed: ${w.missing.join(', ')} (lanes a3-1 / a3-2)`); }
  try {
    fs.mkdirSync(plan.roots.archiveRoot, { recursive: true });
    const s = fs.statfsSync(plan.roots.archiveRoot);
    const free = Number(s.bavail) * Number(s.bsize);
    if (free < plan.totals.bytes * 2) blockers.push(`the archive disk has ${human(free)} free, the comeback needs ${human(plan.totals.bytes * 2)} (twice the stores)`);
    else notes.push(`archive disk: ${human(free)} free for ${human(plan.totals.bytes)} of stores`);
  } catch (error) { if (plan.apply) blockers.push(`cannot read the archive disk: ${error.message}`); }
  return { ok: blockers.length === 0, blockers, notes, engine: eng };
}

/**
 * The functions step 10 calls. machine-db.mjs (a3-2): openMachine (creates machine.sqlite from 0001-init),
 * registerLedger, setControllerMode, recordArchive, CONTROLLERS. ledger-db.mjs (a3-1): ledgerFileFor (the Q1 location
 * %LOCALAPPDATA%/StarCi/projects/<ledger_id>/runtime.sqlite) and openLedger (creates runtime.sqlite from 0001-init).
 */
export async function writersReady() {
  const missing = [];
  let machine = null, ledger = null;
  try { machine = await import('../../engine/machine-db.mjs'); } catch { missing.push('engine/machine-db.mjs'); }
  try { ledger = await import('../../engine/ledger-db.mjs'); } catch { missing.push('engine/ledger-db.mjs'); }
  for (const fn of ['openMachine', 'registerLedger', 'setControllerMode', 'recordArchive']) if (machine && typeof machine[fn] !== 'function') missing.push(`machine-db.mjs ${fn}`);
  if (machine && !Array.isArray(machine.CONTROLLERS)) missing.push('machine-db.mjs CONTROLLERS');
  for (const fn of ['ledgerFileFor', 'openLedger', 'createWorkflow', 'changeWorkflowPhase', 'recordBlob', 'citeBlob']) if (ledger && typeof ledger[fn] !== 'function') missing.push(`ledger-db.mjs ${fn}`);
  let store = null, blobs = null, yaml = null;
  try { store = await import('../kernel/evidence-store.mjs'); } catch { missing.push('scripts/kernel/evidence-store.mjs'); }
  for (const fn of ['stageBlob', 'putArtifact', 'kindOf', 'roleOf']) if (store && typeof store[fn] !== 'function') missing.push(`evidence-store.mjs ${fn}`);
  try { blobs = await import('../lib/artifact-store.mjs'); } catch { missing.push('scripts/lib/artifact-store.mjs'); }
  try { yaml = await import('../../engine/yaml.mjs'); } catch { missing.push('engine/yaml.mjs'); }
  return { ok: missing.length === 0, missing, machine, ledger, store, blobs, yaml };
}

/** The relaunch list (§6.2 step 1): live workflows of the product ledgers, the FE canon workflow and Q9 ledgers excluded. */
export function relaunchList(plan) {
  const list = [], excluded = [];
  for (const l of plan.ledgers) {
    for (const wf of l.workflows) {
      if (['finished', 'archived'].includes(wf.phase) || wf.archivedAt) continue;
      const why = l.kind === 'supervisor-ledger' ? 'the Supervisor ledger moves into machine.sup_* (Q3)'
        : DROPPED_LEDGERS.includes(l.name) ? 'smoke ledger dropped (Q9)'
          : FE_CANON.test(wf.workflowId) ? 'the FE canon refactor is finished by Devin outside the harness (Q8)' : null;
      if (why) { excluded.push({ ledger: l.name, workflowId: wf.workflowId, why }); continue; }
      list.push({ ledger: l.name, repo: l.repo, workflowId: wf.workflowId, title: wf.title, displayName: wf.displayName, sourceRoots: wf.sourceRoots,
        goalRevision: wf.goal?.revision ?? null, goal: wf.goal?.markdown ?? null, chain: wf.goal?.json ?? null });
    }
  }
  return { list, excluded };
}

// ---------------------------------------------------------------------------------------------------------------
// the plan
// ---------------------------------------------------------------------------------------------------------------
export function buildPlan(opts = {}, env = process.env) {
  const roots = rootsOf(opts, env);
  const ledgersOld = oldLedgers(roots);
  const { repos, unmanaged } = managedRepos(roots, ledgersOld);
  const dbs = oldDatabases(roots, repos);
  const ledgers = dbs.filter((d) => ['project-ledger', 'supervisor-ledger'].includes(d.kind)).map((d) => {
    const repo = d.kind === 'supervisor-ledger' ? null : path.dirname(path.dirname(d.main));
    return { name: repo ? path.basename(repo) : 'supervisor', kind: d.kind, repo, file: d.main, workflows: workflowsOf(d.main) };
  });
  const keepWorkflows = ledgers.flatMap((l) => l.workflows.map((w) => w.workflowId)).filter((id) => FE_CANON.test(id));
  const stateLogs = oldStateAndLogs(roots).map((s) => {
    const w = walkFiles(s.path, { roots });
    return { ...s, files: w.files.length, bytes: w.bytes, links: w.links.length, secrets: w.secrets.length };
  });
  const starciwork = repos.map(({ repo, name }) => {
    const data = starciworkAgentData(repo);
    const units = data.units.map((u) => { const w = walkFiles(u.abs, { roots }); return { ...u, files: w.files.length, bytes: w.bytes, links: w.links.length, secrets: w.secrets.length }; });
    const tracked = gitResult(['ls-files', '-z', '--', '.starciwork'], { dir: repo });
    const trackedSet = tracked.ok ? tracked.stdout.split('\0').filter(Boolean).map((p) => p.replace(/^\.starciwork\//, '')) : [];
    for (const u of units) u.tracked = trackedSet.filter((t) => t === u.rel || t.startsWith(`${u.rel}/`)).length;
    return { repo, name, units, drift: data.drift.length, driftSample: data.drift.slice(0, 8), productFiles: data.productFiles };
  });
  const worktrees = opWorktrees(roots, repos, { keepWorkflows }).map((w) => {
    const target = w.scratchDir && !w.path.startsWith(w.scratchDir) ? w.scratchDir : w.path;
    const sized = walkFiles(w.scratchDir ?? w.path, { roots, skipDir: (_abs, n) => n === 'node_modules' || n === '.git' });
    return { ...w, target, files: sized.files.length, bytes: sized.bytes, links: sized.links.length, secrets: sized.secrets.length };
  });
  const bytesOf = (xs) => xs.reduce((s, x) => s + (x.bytes || 0), 0);
  const totals = {
    dbs: bytesOf(dbs), state: bytesOf(stateLogs.filter((s) => s.group === 'state' && !s.keep)), logs: bytesOf(stateLogs.filter((s) => s.group === 'logs')),
    starciwork: starciwork.reduce((s, r) => s + bytesOf(r.units), 0), worktrees: bytesOf(worktrees.filter((w) => !w.keep)),
  };
  totals.bytes = totals.dbs + totals.state + totals.logs + totals.starciwork + totals.worktrees;
  const plan = { schema: 'starci/comeback-plan@1', apply: opts.apply === true, roots, repos, unmanaged, dbs, ledgers, stateLogs, starciwork, worktrees, totals };
  const newMachine = path.join(roots.starciLocal, 'machine.sqlite');
  plan.newMachine = exists(newMachine) ? validateNewMachine(newMachine) : null;
  plan.relaunch = relaunchList(plan);
  plan.citations = citationScan(plan);
  return plan;
}

// ---------------------------------------------------------------------------------------------------------------
// Q12 and product evidence: Work records citing agent data
// ---------------------------------------------------------------------------------------------------------------
// Owner correction (2026-09-28): UAT images and videos, approved drawings and every file a Work record cites are
// PRODUCT EVIDENCE. Before anything is archived, each cited file that still exists is put in the blob store (redacted
// when it is text), re-read and re-hashed, filed as a job_artifacts row of the ledger's comeback carrier workflow,
// cited in work_citations (which pins it: GC never removes it) and the record's citation is rewritten to
// {artifact, sha256}. Only a record whose cited evidence is truly gone is marked stale. Caches, stray reports and
// uncited agent data are archived and deleted as before.
const PATHISH = /[A-Za-z0-9_.@()\-]+(?:\/[A-Za-z0-9_.@()\-]+)+\/?/g;
const NOT_EVIDENCE = new Set(['ledger', 'logs-db', 'worktrees', 'cache', 'stray-report', 'legacy-import']);

/** Every path token in one record file's text that names agent data: [{raw, rel, category}] (rel is .starciwork-relative). */
export function citationTokens(text, recordRel, recordAbsRoot = null) {
  const out = new Map();
  const dir = path.posix.dirname(recordRel);
  for (const m of text.matchAll(PATHISH)) {
    // Prose around a path: strip the sentence punctuation that follows it ("…/answer-1.json)." -> "…/answer-1.json").
    const raw = m[0].replace(/[.,;:)]+$/, '').replace(/\/$/, '');
    let p = raw;
    if (/^https?:|^\/\//.test(p) || p.includes('://')) continue;
    if (p.startsWith('.starciwork/')) p = p.slice('.starciwork/'.length);
    else if (/^(E|runs|assets|evidence)\//.test(p)) {
      // Node-relative (E/, runs/, assets/, evidence/<id>/): the record's own folder first, then each folder above it up
      // to the Work root; the first that exists wins, else the record's folder (E/runs/assets) or the root (evidence/).
      const tries = [];
      for (let d = dir; d && d !== '.'; d = path.posix.dirname(d)) tries.push(path.posix.normalize(`${d}/${p}`));
      tries.push(p);
      p = (recordAbsRoot && tries.find((t) => exists(path.join(recordAbsRoot, t)))) ?? (p.startsWith('evidence/') ? p : tries[0]);
    } else if (!/^(features|kernel-evidence|kernel-strays|brand|shell|_resources|settle-parity|settle-tail)\//.test(p)) continue;
    // A citation names a file (it has an extension), sits under .starciwork/ or kernel-evidence/, or exists on disk;
    // a bare slash-joined phrase in prose ("evidence/policy") is not one.
    const workRoot = recordAbsRoot;
    if (!raw.startsWith('.starciwork/') && !p.startsWith('kernel-evidence/') && !/\.[A-Za-z0-9]{1,5}$/.test(p) && !(workRoot && exists(path.join(workRoot, p)))) continue;
    let category = agentDataCategory(p) ?? agentDataCategory(p, { dir: true });
    // An approved interface.draw direction stays in the Work tree (Q2) and is also pinned as a blob; its path stays.
    const keepPath = !category && /^features\/[^/]+\/ui\/.+\/assets\/.+\.(png|jpe?g|webp|gif|svg|mp4|webm)$/i.test(p);
    if (keepPath) category = 'direction';
    if (category && !['ledger', 'logs-db', 'worktrees'].includes(category) && !out.has(raw)) out.set(raw, { raw, rel: p, category, keepPath });
  }
  return [...out.values()];
}
/** The cited agent-data paths of one record (relative to .starciwork). */
export const citedAgentPaths = (text, recordRel) => [...new Set(citationTokens(text, recordRel).filter((t) => !t.keepPath).map((t) => t.rel))];

/** A record's id: its `id:` (or evidence.yaml `record:`) field, else its path. */
const recordIdOf = (text, rel) => /^(?:id|record):\s*['"]?([^\s'"#]+)/m.exec(text)?.[1] ?? rel;

/**
 * Every product record citing agent data, per repo, with each citation resolved on disk: ingest (the file or tree
 * exists and is evidence), missing (gone, or a cache / stray report that is never evidence). Sizes per category.
 */
export function citationScan(plan) {
  const out = [];
  for (const r of plan.starciwork) {
    const work = path.join(r.repo, '.starciwork');
    if (!exists(work)) continue;
    const records = [];
    const ingestFiles = new Map();
    const walk = (rel) => {
      let entries;
      try { entries = fs.readdirSync(path.join(work, rel), { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const r2 = rel ? `${rel}/${e.name}` : e.name;
        if (agentDataCategory(r2, { dir: e.isDirectory() })) continue;
        if (e.isDirectory()) { if (!e.isSymbolicLink()) walk(r2); continue; }
        if (!/\.ya?ml$/.test(e.name)) continue;
        let text;
        try { text = fs.readFileSync(path.join(work, r2), 'utf8'); } catch { continue; }
        const tokens = citationTokens(text, r2, work);
        if (!tokens.length) continue;
        const cites = tokens.map((t) => {
          const abs = path.join(work, t.rel);
          let st = null;
          try { st = fs.lstatSync(abs); } catch { /* gone */ }
          const evidence = st && !NOT_EVIDENCE.has(t.category) && !st.isSymbolicLink();
          const files = evidence ? walkFiles(abs, { roots: plan.roots }).files : [];
          for (const f of files) ingestFiles.set(pathKey(f.abs), f);
          return { ...t, abs, isDir: Boolean(st?.isDirectory()), ingest: Boolean(evidence && files.length), files: files.length, bytes: files.reduce((s, f) => s + f.size, 0) };
        });
        const missing = cites.filter((c) => !c.ingest && !c.keepPath);
        records.push({ rel: r2, recordId: recordIdOf(text, r2), cites, missing: missing.length, sample: missing.slice(0, 3).map((c) => c.rel),
          done: /^state:\s*done\s*$/m.test(text), evidence: /(^|\/)evidence\.yaml$/.test(r2), alreadyStale: /^stale:\s*true\s*$/m.test(text) });
      }
    };
    walk('');
    const stale = records.filter((x) => x.missing > 0);
    const files = [...ingestFiles.values()];
    out.push({ repo: r.repo, name: r.name, records,
      ingest: { records: records.filter((x) => x.cites.some((c) => c.ingest)).length, citations: records.reduce((s, x) => s + x.cites.filter((c) => c.ingest).length, 0), files: files.length, bytes: files.reduce((s, f) => s + f.size, 0) },
      stale: { records: stale.length, missingPaths: stale.reduce((s, x) => s + x.missing, 0),
        demote: stale.filter((x) => !x.evidence && x.done).length, markStale: stale.filter((x) => x.evidence && !x.alreadyStale).length } });
  }
  return out;
}

/** Apply Q12 to one record file: evidence.yaml gets stale + staleReason; a done index.yaml goes back to todo. */
export function markStaleText(text, { evidence, reason }) {
  if (evidence) {
    if (/^stale:\s*true\s*$/m.test(text)) return null;
    const body = text.endsWith('\n') ? text : `${text}\n`;
    return `${body}stale: true\nstaleReason: ${JSON.stringify(reason)}\n`;
  }
  if (!/^state:\s*done\s*$/m.test(text)) return null;
  return text.replace(/^state:\s*done\s*$/m, `# ${reason}\nstate: todo`);
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/**
 * Rewrite each ingested citation `raw` to its artifact: a scalar that is the whole value becomes the flow map
 * {artifact: <id>, sha256: <sha>}; a path inside prose becomes `artifact:<id> sha256:<sha>`. Returns the new text,
 * or null when the result is not YAML (the caller then keeps the text and the record goes stale).
 */
export function rewriteCitations(text, refs, parse) {
  let next = text;
  for (const { raw, artifactId, sha256 } of refs) {
    const whole = new RegExp(`^(\\s*(?:-\\s+)?(?:[A-Za-z0-9_.-]+:\\s+)?)(['"]?)${escapeRe(raw)}\\/?\\2(\\s*(?:#.*)?)$`, 'gm');
    next = next.replace(whole, (_m, lead, _q, tail) => `${lead}{artifact: ${artifactId}, sha256: ${sha256}}${tail}`);
    next = next.split(raw).join(`artifact:${artifactId} sha256:${sha256}`);
  }
  try { parse(next); return next; } catch { return null; }
}

/** job_artifacts role / subkind and work_citations role for one ingested file. */
function evidenceRoles(category, rel, kind) {
  if (category === 'direction') return { role: 'direction', subkind: null, citeRole: 'direction' };
  if (category === 'uat-run') return { role: 'uat-run', subkind: kind === 'video' ? 'uat-video' : kind === 'image' ? 'uat-capture' : null, citeRole: kind === 'video' ? 'uat-video' : kind === 'image' ? 'uat-screen' : 'uat-result' };
  if (category === 'draw-round') return { role: 'render', subkind: kind === 'image' ? 'draw-render' : null, citeRole: 'render' };
  if (category === 'layout-capture') return { role: 'capture', subkind: kind === 'image' ? 'app-capture' : null, citeRole: 'layout-capture' };
  if (category === 'capture') return { role: kind === 'video' ? 'video' : 'capture', subkind: kind === 'image' ? (rel.includes('/impl/') ? 'app-capture' : 'e2e-capture') : kind === 'video' ? 'e2e-video' : null, citeRole: 'capture' };
  return { role: null, subkind: null, citeRole: null };
}

/**
 * Ingest one repo's cited evidence into its fresh ledger. `w` = {ledger (ledger-db), store (evidence-store), blobs
 * (artifact-store), yaml}. Returns {files, citations, records, failed: [{record, raw, error}]}.
 */
export function ingestRepoEvidence(scan, ledgerFile, w, { date, now = Date.now() } = {}) {
  const out = { files: 0, citations: 0, records: [], failed: [] };
  const wf = `wf-comeback-evidence-${date}`;
  const h = w.ledger.openLedger({ file: ledgerFile });
  try {
    h.transaction((db) => {
      if (db.prepare('SELECT 1 FROM workflows WHERE workflow_id=?').get(wf)) return;
      w.ledger.createWorkflow(db, { workflowId: wf, by: 'comeback', reason: 'product evidence carried over by the comeback',
        title: 'comeback evidence', displayName: 'Comeback · bằng chứng sản phẩm giữ lại' });
      w.ledger.changeWorkflowPhase(db, { workflowId: wf, to: 'stopped', by: 'comeback', reason: 'a carrier of product evidence: never runs' });
    });
    const staged = new Map();
    // One blob per file, OUTSIDE any transaction: put (text is redacted), then re-read and re-hash.
    const stageFile = (abs) => {
      const k = pathKey(abs);
      if (staged.has(k)) return staged.get(k);
      const blob = w.store.stageBlob(abs);
      const back = w.blobs.getBlob(blob.sha); // throws unless the stored bytes hash to their name
      if (blob.redaction === 'binary' && sha256File(abs) !== blob.sha) throw new Error(`${abs}: stored bytes differ from the original`);
      if (back.length !== blob.bytes) throw new Error(`${abs}: stored size differs`);
      staged.set(k, blob);
      return blob;
    };
    for (const rec of scan.records) {
      const refs = [];
      for (const c of rec.cites.filter((x) => x.ingest)) {
        try {
          const files = walkFiles(c.abs, {}).files;
          const blobs = files.map((f) => ({ f, blob: stageFile(f.abs), rel: slash(path.relative(path.join(scan.repo, '.starciwork'), f.abs)) }));
          const manifestBlob = c.isDir ? w.store.stageBlob(Buffer.from(JSON.stringify({ schema: 'starci/comeback-evidence-set@1', path: c.rel,
            files: blobs.map((b) => ({ name: b.rel, sha256: b.blob.sha, bytes: b.blob.bytes, mediaType: b.blob.mediaType })) }, null, 2)), { mediaType: 'application/json', file: false }) : null;
          if (manifestBlob) w.blobs.getBlob(manifestBlob.sha);
          const ref = h.transaction((db) => {
            const ids = [];
            for (const b of blobs) {
              const kind = w.store.kindOf(b.rel);
              const roles = evidenceRoles(c.category, b.rel, kind);
              const a = w.store.putArtifact(db, { workflowId: wf, origin: 'kernel', role: roles.role ?? w.store.roleOf(b.rel), kind, subkind: roles.subkind,
                name: `comeback/${b.rel}`, blob: b.blob, scopeRef: rec.recordId, runId: c.category === 'uat-run' ? /\/runs\/([^/]+)/.exec(`/${b.rel}`)?.[1] ?? null : null, now });
              w.ledger.recordBlob(db, { sha256: b.blob.sha, bytes: b.blob.bytes, mediaType: b.blob.mediaType, fileUri: b.blob.fileUri, redaction: b.blob.redaction, pinned: 1, createdAt: now });
              ids.push({ artifactId: a.artifactId, sha256: b.blob.sha, roles });
            }
            const cited = manifestBlob
              ? { artifactId: w.store.putArtifact(db, { workflowId: wf, origin: 'kernel', role: c.category === 'uat-run' ? 'uat-run' : 'other', kind: 'file',
                name: `comeback/${c.rel}/manifest.json`, blob: manifestBlob, scopeRef: rec.recordId, now }).artifactId, sha256: manifestBlob.sha, roles: evidenceRoles(c.category, c.rel, 'file') }
              : ids[0];
            w.ledger.citeBlob(db, { recordId: rec.recordId, recordPath: rec.rel, field: `comeback:${c.raw}`, sha256: cited.sha256, artifactId: cited.artifactId,
              role: cited.roles.citeRole, createdAt: now });
            return { raw: c.raw, artifactId: cited.artifactId, sha256: cited.sha256 };
          });
          if (!c.keepPath) refs.push(ref);
          out.files += blobs.length;
          out.citations += 1;
        } catch (error) { out.failed.push({ record: rec.rel, raw: c.raw, error: String(error?.message ?? error) }); }
      }
      if (!refs.length) continue;
      const file = path.join(scan.repo, '.starciwork', rec.rel);
      const text = fs.readFileSync(file, 'utf8');
      const next = rewriteCitations(text, refs, w.yaml.parseYaml);
      if (next == null) { out.failed.push({ record: rec.rel, raw: '*', error: 'the rewritten record is not YAML: citations kept, the record goes stale' }); continue; }
      if (next !== text) { fs.writeFileSync(file, next); out.records.push({ repo: scan.repo, record: rec.rel, refs }); }
    }
  } finally { h.close(); }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// apply steps
// ---------------------------------------------------------------------------------------------------------------
const manifestFile = (roots) => path.join(roots.comebackDir, 'manifest.json');
export function readManifest(roots) {
  try { return JSON.parse(fs.readFileSync(manifestFile(roots), 'utf8')); } catch { return null; }
}
function writeManifest(roots, m) {
  fs.mkdirSync(roots.comebackDir, { recursive: true });
  const tmp = `${manifestFile(roots)}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(m, null, 2)}\n`);
  fs.renameSync(tmp, manifestFile(roots));
}

/** The archive groups: [{name, sources: [{unit, root, files: [{abs,size,mtimeMs}], extra?: [{name, data}]}]}]. */
function archiveGroups(plan) {
  const groups = [];
  const { roots } = plan;
  groups.push({ name: 'databases', sources: plan.dbs.filter((d) => !ALPHA3_KINDS.has(d.kind)).map((d) => ({ unit: `db:${d.label}`, root: d.main, files: d.files.map((f) => { const s = fs.statSync(f); return { abs: f, size: s.size, mtimeMs: s.mtimeMs }; }) })) });
  for (const g of ['state', 'logs']) {
    groups.push({ name: g, sources: plan.stateLogs.filter((s) => s.group === g && !s.keep).map((s) => ({ unit: `${g}:${s.label}`, root: s.path, files: walkFiles(s.path, { roots }).files })) });
  }
  for (const r of plan.starciwork) {
    if (!r.units.length) continue;
    groups.push({ name: `starciwork-${r.name}`, sources: r.units.map((u) => ({ unit: `starciwork:${r.name}:${u.rel}`, root: u.abs, files: walkFiles(u.abs, { roots }).files })) });
  }
  const wts = plan.worktrees.filter((w) => !w.keep && w.exists);
  for (const w of wts) {
    const base = w.scratchDir ?? w.path;
    const files = walkFiles(base, { roots, skipDir: (_abs, n) => n === 'node_modules' || n === '.git' }).files;
    const extra = [];
    if (!w.leftover && w.dirty) {
      const st = gitResult(['status', '--porcelain', '--untracked-files=normal'], { dir: w.path });
      const diff = gitResult(['diff', 'HEAD', '--binary'], { dir: w.path, maxBuffer: 512 * 1024 * 1024 });
      extra.push({ name: `__comeback__/worktrees/${entryNameOf(w.path)}/status.txt`, data: st.stdout });
      extra.push({ name: `__comeback__/worktrees/${entryNameOf(w.path)}/diff-HEAD.patch`, data: diff.stdout });
    }
    groups.push({ name: `worktree-${(w.repoName ?? 'scratch')}-${path.basename(base)}`, sources: [{ unit: `worktree:${slash(w.path)}`, root: base, files, extra }] });
  }
  return groups.filter((g) => g.sources.length);
}

/** Write one group's zip parts, then re-open every part and compare each entry's sha256 and the entry count. */
function archiveGroup(roots, group, manifest) {
  const done = manifest.zips.filter((z) => z.group === group.name && z.verifiedAt);
  if (done.length) return { skipped: true, zips: done };
  const entries = [];
  for (const s of group.sources) {
    for (const f of s.files) entries.push({ unit: s.unit, name: entryNameOf(f.abs), file: f.abs, size: f.size, mtimeMs: f.mtimeMs });
    for (const x of s.extra ?? []) entries.push({ unit: s.unit, name: x.name, data: x.data, size: Buffer.byteLength(x.data ?? '') });
  }
  const parts = [];
  let cur = [], bytes = 0;
  for (const e of entries) {
    if (e.size >= 0xffffffff) throw new Error(`${e.file}: ${human(e.size)} is past the 4 GiB zip entry limit`);
    if (cur.length && (cur.length >= PART_MAX_ENTRIES || bytes + e.size > PART_MAX_BYTES)) { parts.push(cur); cur = []; bytes = 0; }
    cur.push(e); bytes += e.size;
  }
  if (cur.length || !parts.length) parts.push(cur);
  const zips = [];
  parts.forEach((part, i) => {
    const file = path.join(roots.comebackDir, `${group.name.replace(/[^A-Za-z0-9._-]+/g, '_')}-${String(i + 1).padStart(2, '0')}.zip`);
    if (exists(file)) fs.renameSync(file, `${file}.partial-${Date.now()}`); // an unverified leftover of an interrupted run
    const written = writeZip(file, part.map((e) => (e.data != null ? { name: e.name, data: e.data } : { name: e.name, file: e.file })));
    const read = readZip(file);
    const bad = [];
    if (read.length !== part.length) bad.push(`entry count ${read.length} != ${part.length}`);
    const want = new Map(written.entries.map((e) => [e.name, e.sha256]));
    for (const r of read) if (!r.crcOk || sha256Of(r.data) !== want.get(r.name)) bad.push(`${r.name}: content mismatch`);
    if (sha256File(file) !== written.sha256) bad.push('zip sha256 changed after write');
    if (bad.length) throw new Error(`${file} failed verification: ${bad.slice(0, 5).join('; ')}`);
    zips.push({ group: group.name, file, bytes: written.bytes, sha256: written.sha256, entries: written.entries.length, verifiedAt: Date.now(),
      units: [...new Set(part.map((e) => e.unit))],
      files: part.filter((e) => e.file).map((e) => ({ abs: e.file, name: e.name, size: e.size, mtimeMs: e.mtimeMs, sha256: want.get(e.name) })) });
  });
  return { skipped: false, zips };
}

/** Before a delete: every file now under `root` is in a verified zip with the same size and mtime. */
function archivedCompletely(root, manifest, roots, { skipDir } = {}) {
  const known = new Map();
  for (const z of manifest.zips) for (const f of z.files ?? []) known.set(pathKey(f.abs), f);
  const now = walkFiles(root, { roots, skipDir });
  const missing = now.files.filter((f) => { const k = known.get(pathKey(f.abs)); return !k || k.size !== f.size || Math.abs(k.mtimeMs - f.mtimeMs) > 2; });
  return { ok: missing.length === 0 && now.secrets.length === 0, missing: missing.slice(0, 5).map((f) => f.abs), count: missing.length, secrets: now.secrets.length };
}

function removePath(target, manifest, roots, { skipDir, worktreeRepo = null } = {}) {
  if (!exists(target)) return { ok: true, gone: true };
  if (isSecretPath(target, roots)) return { ok: false, error: 'a secret path is never removed' };
  const full = archivedCompletely(target, manifest, roots, { skipDir });
  if (!full.ok) return { ok: false, error: full.secrets ? `${full.secrets} secret file(s) inside: kept` : `${full.count} file(s) not in a verified archive (e.g. ${full.missing[0]}): kept` };
  const st = fs.lstatSync(target);
  if (!st.isDirectory() || isLinkLike(target, { stat: st })) return { ok: unlinkOnly(target) || (() => { try { fs.unlinkSync(target); return true; } catch { return false; } })() };
  const out = worktreeRepo ? safeRemoveWorktree(target, { repo: worktreeRepo }) : safeRemoveTree(target);
  return { ok: out.ok, removed: out.removed, error: out.ok ? null : out.errors.slice(0, 3).map((e) => `${e.code} ${e.path}`).join('; ') };
}

/** Run the comeback. Only the owner's go runs this; the default CLI path is the dry run. */
export async function applyComeback(plan, { terminals = null, now = Date.now(), log = () => {}, writers = null, pidAlive = defaultPidAlive } = {}) {
  const { roots } = plan;
  const pre = await preconditions(plan, { terminals, now, writers, pidAlive });
  if (!pre.ok) return { ok: false, refused: true, blockers: pre.blockers };
  fs.mkdirSync(roots.comebackDir, { recursive: true });
  const manifest = readManifest(roots) ?? { schema: SCHEMA, createdAt: new Date(now).toISOString(), date: roots.date, roots, steps: {}, zips: [], dbFacts: {}, archiveRefs: [], removed: [], kept: [], stale: [], commits: [], fresh: null };
  const runtimeHead = gitResult(['rev-parse', 'HEAD'], { dir: roots.runtimeRoot });
  manifest.runtimeRev ??= runtimeHead.ok ? runtimeHead.stdout.trim() : null;
  const step = (name, fn) => { if (manifest.steps[name]?.done) { log(`skip ${name} (done)`); return; } log(`step ${name}`); const r = fn(); manifest.steps[name] = { done: true, at: new Date().toISOString(), ...(r ?? {}) }; writeManifest(roots, manifest); };

  step('relaunch', () => {
    fs.mkdirSync(path.join(roots.comebackDir, 'relaunch'), { recursive: true });
    for (const r of plan.relaunch.list) if (r.goal) fs.writeFileSync(path.join(roots.comebackDir, 'relaunch', `${r.workflowId}.md`), r.goal);
    fs.writeFileSync(path.join(roots.comebackDir, 'relaunch.json'), `${JSON.stringify(plan.relaunch, null, 2)}\n`);
    return { workflows: plan.relaunch.list.length };
  });
  step('db-facts', () => { for (const d of plan.dbs) manifest.dbFacts[d.label] = { file: d.main, ...dbFacts(d.main) }; return { dbs: plan.dbs.length }; });
  const w = writers ?? await writersReady();
  step('reset-alpha3', () => {
    const alpha3 = plan.dbs.filter((d) => ALPHA3_KINDS.has(d.kind));
    if (!alpha3.length) return { dbs: 0 };
    const group = { name: 'alpha3-stores', sources: alpha3.map((d) => ({ unit: `db:${d.label}`, root: d.main, files: d.files.map((f) => { const st = fs.statSync(f); return { abs: f, size: st.size, mtimeMs: st.mtimeMs }; }) })) };
    const r = archiveGroup(roots, group, manifest);
    if (!r.skipped) manifest.zips.push(...r.zips);
    writeManifest(roots, manifest);
    for (const d of alpha3) for (const f of d.files) { const x = removePath(f, manifest, roots); (x.ok ? manifest.removed : manifest.kept).push({ kind: 'db', path: f, ...(x.ok ? {} : { why: x.error }) }); }
    if (manifest.kept.some((k) => alpha3.some((d) => d.files.includes(k.path)))) throw new Error('an alpha.3 store could not be removed; the fresh DBs are not created over it');
    return { dbs: alpha3.length };
  });
  if (!manifest.fresh?.ok) {
    const fresh = freshDatabases(plan, w);
    manifest.fresh = fresh;
    manifest.steps['fresh-dbs'] = { done: fresh.ok, at: new Date().toISOString() };
    writeManifest(roots, manifest);
    if (!fresh.ok) return { ok: false, manifest: manifestFile(roots), error: fresh.error };
  }
  step('ingest', () => {
    // Product evidence first: put, re-hash, file, cite and pin every cited file BEFORE the originals are archived.
    manifest.ingest ??= [];
    for (const scan of citationScan(plan)) {
      const ledger = manifest.fresh.ledgers.find((l) => samePath(pathKey(l.repo), pathKey(scan.repo)));
      if (!scan.records.some((x) => x.cites.some((c) => c.ingest))) continue;
      if (!ledger) { manifest.ingest.push({ repo: scan.repo, skipped: 'no fresh ledger (dropped or not a product ledger): its citations go stale' }); continue; }
      const r = ingestRepoEvidence(scan, ledger.file, w, { date: roots.date, now });
      manifest.ingest.push({ repo: scan.repo, ledger: ledger.name, files: r.files, citations: r.citations, records: r.records.map((x) => x.record), failed: r.failed });
      writeManifest(roots, manifest);
    }
    return { repos: manifest.ingest.length, files: manifest.ingest.reduce((s, x) => s + (x.files ?? 0), 0), failed: manifest.ingest.reduce((s, x) => s + (x.failed?.length ?? 0), 0) };
  });
  step('archive', () => {
    for (const g of archiveGroups(plan)) { const r = archiveGroup(roots, g, manifest); if (!r.skipped) { manifest.zips.push(...r.zips); writeManifest(roots, manifest); } }
    return { zips: manifest.zips.length, bytes: manifest.zips.reduce((s, z) => s + z.bytes, 0) };
  });
  step('verify', () => {
    for (const z of manifest.zips) {
      if (sha256File(z.file) !== z.sha256) throw new Error(`${z.file}: sha256 changed since it was verified; nothing is removed`);
      if (readZip(z.file).length !== z.entries) throw new Error(`${z.file}: entry count changed; nothing is removed`);
    }
    return { zips: manifest.zips.length };
  });
  step('archive-refs', () => {
    for (const w of plan.worktrees.filter((x) => !x.keep && x.head && x.repo && x.unlanded)) {
      const ref = `refs/starci/archive/${w.branch ?? `detached-${w.head.slice(0, 8)}`}`;
      const r = gitResult(['update-ref', ref, w.head], { dir: w.repo });
      manifest.archiveRefs.push({ repo: w.repo, ref, head: w.head, ok: r.ok, error: r.ok ? null : r.error });
      if (!r.ok) throw new Error(`${w.repo}: could not keep ${w.head} at ${ref}: ${r.error}`);
    }
    return { refs: manifest.archiveRefs.length };
  });
  step('delete', () => {
    const rm = (kind, target, opts = {}) => { const r = removePath(target, manifest, roots, opts); (r.ok ? manifest.removed : manifest.kept).push({ kind, path: target, ...(r.ok ? {} : { why: r.error }) }); };
    // DB files first: the old registry goes with them, so artifact-hold no longer holds the trees below.
    for (const d of plan.dbs.filter((x) => !ALPHA3_KINDS.has(x.kind))) for (const f of d.files) rm('db', f);
    for (const s of plan.stateLogs) { if (s.keep) manifest.kept.push({ kind: s.group, path: s.path, why: s.keep }); else rm(s.group, s.path); }
    for (const r of plan.starciwork) for (const u of r.units) rm(`starciwork:${u.category}`, u.abs);
    for (const w of plan.worktrees) {
      if (w.keep) { manifest.kept.push({ kind: 'worktree', path: w.path, why: w.keep }); continue; }
      const skipDir = (_abs, n) => n === 'node_modules' || n === '.git';
      // The node_modules junction into the live checkout goes first, as a link, before any tree walk.
      for (const base of [w.path, w.scratchDir && path.join(w.scratchDir, 'wt')].filter(Boolean)) {
        const nm = path.join(base, 'node_modules');
        if (exists(nm) && isLinkLike(nm) && !unlinkOnly(nm)) manifest.kept.push({ kind: 'worktree', path: nm, why: 'the node_modules link could not be unlinked' });
      }
      if (w.repo && !w.leftover) rm('worktree', w.path, { skipDir, worktreeRepo: w.repo });
      else rm('worktree', w.path, { skipDir });
      if (w.scratchDir && exists(w.scratchDir)) rm('push-scratch', w.scratchDir, { skipDir });
    }
    for (const { repo } of plan.repos) {
      gitResult(['worktree', 'prune'], { dir: repo });
      // Empty worktree parents (<wf8>/, worktrees/, and a frontend repo's then-empty .starciwork): rmdir only removes empty directories.
      const wtRoot = path.join(repo, '.starciwork', 'worktrees');
      for (const d of [...(exists(wtRoot) ? fs.readdirSync(wtRoot).map((n) => path.join(wtRoot, n)) : []), wtRoot, path.join(repo, '.starciwork')]) {
        try { if (fs.lstatSync(d).isDirectory() && fs.readdirSync(d).length === 0) fs.rmdirSync(d); } catch { /* not empty or gone */ }
      }
    }
    gitResult(['worktree', 'prune'], { dir: roots.runtimeRoot });
    return { removed: manifest.removed.length, kept: manifest.kept.length };
  });
  step('stale', () => {
    // After the ingest rewrote every ingested citation, a record still naming agent data cites something truly gone.
    const zipOf = (name) => manifest.zips.find((z) => z.group === `starciwork-${name}`)?.file ?? null;
    for (const c of citationScan({ ...plan })) {
      for (const rec of c.records.filter((x) => x.missing > 0)) {
        const file = path.join(c.repo, '.starciwork', rec.rel);
        const reason = `comeback ${roots.date} (Q12): evidence-missing - ${rec.missing} cited agent path(s) no longer exist (the originals, if any, are in ${slash(zipOf(c.name) ?? manifestFile(roots))}); the relaunched workflow proves it again`;
        const next = markStaleText(fs.readFileSync(file, 'utf8'), { evidence: rec.evidence, reason });
        if (next != null) { fs.writeFileSync(file, next); manifest.stale.push({ repo: c.repo, record: rec.rel, action: rec.evidence ? 'stale' : 'todo' }); }
      }
    }
    return { records: manifest.stale.length };
  });
  step('product-commits', () => {
    for (const r of plan.starciwork) {
      const work = path.join(r.repo, '.starciwork');
      if (!exists(path.join(work, 'workspace.yaml')) && !exists(path.join(work, 'index.yaml'))) continue; // not a backend Work tree
      // Stage exactly what the comeback changed: the removed agent paths, the Q12 edits and the new .gitignore -
      // never an owner's unrelated work in progress. A repo whose index already holds staged changes is left alone.
      if (!gitResult(['diff', '--cached', '--quiet'], { dir: r.repo }).ok) {
        manifest.commits.push({ repo: r.repo, ok: false, error: 'the index already holds staged changes: commit the comeback paths by hand' });
        continue;
      }
      fs.writeFileSync(path.join(work, '.gitignore'), starciworkGitignoreText());
      const paths = ['.starciwork/.gitignore', ...r.units.filter((u) => u.tracked > 0).map((u) => `.starciwork/${u.rel}`),
        ...manifest.stale.filter((s) => samePath(pathKey(s.repo), pathKey(r.repo))).map((s) => `.starciwork/${s.record}`),
        ...(manifest.ingest ?? []).filter((x) => x.repo && samePath(pathKey(x.repo), pathKey(r.repo))).flatMap((x) => (x.records ?? []).map((rec) => `.starciwork/${rec}`))];
      const list = path.join(roots.comebackDir, `stage-${r.name}.txt`);
      fs.writeFileSync(list, `${paths.join('\n')}\n`);
      gitResult(['add', '-A', '--ignore-errors', `--pathspec-from-file=${list}`], { dir: r.repo });
      const staged = gitResult(['diff', '--cached', '--quiet'], { dir: r.repo });
      if (staged.ok) continue;
      const c = gitResult(['commit', '-m', 'chore(starciwork): comeback - agent data moved to SQL/blob'], { dir: r.repo });
      manifest.commits.push({ repo: r.repo, ok: c.ok, sha: c.ok ? gitResult(['rev-parse', 'HEAD'], { dir: r.repo }).stdout.trim() : null, error: c.ok ? null : c.error,
        push: `node scripts/supervisor/push-mains.mjs --repo ${slash(r.repo)}` });
    }
    return { commits: manifest.commits.length };
  });
  step('record-archives', () => {
    const machine = w.machine.openMachine({});
    try {
      for (const z of manifest.zips) {
        w.machine.recordArchive(machine, { archivePath: z.file, kind: 'comeback', subject: z.group, bytes: z.bytes, sha256: z.sha256,
          manifestSha256: null, entries: z.entries, integrity: 'sha-verified', createdAt: z.verifiedAt, verifiedAt: z.verifiedAt, expiresAt: null });
      }
    } finally { try { machine?.close?.(); } catch { /* closed */ } }
    return { archives: manifest.zips.length };
  });
  manifest.postBaseline = baselineListing(plan);
  writeManifest(roots, manifest);
  const ingested = (manifest.ingest ?? []).reduce((s, x) => s + (x.files ?? 0), 0);
  return { ok: true, manifest: manifestFile(roots), removed: manifest.removed.length, kept: manifest.kept, ingested, ingest: manifest.ingest, stale: manifest.stale.length, commits: manifest.commits, fresh: manifest.fresh };
}

/** Step 10, run before the ingest: fresh machine.sqlite (controllers in shadow) and one runtime.sqlite per product ledger. */
function freshDatabases(plan, w) {
  if (!w?.ok) return { ok: false, error: `writers missing: ${(w?.missing ?? []).join(', ')}` };
  const machine = w.machine.openMachine({});
  const ledgers = [];
  try {
    for (const controller of w.machine.CONTROLLERS) w.machine.setControllerMode(machine, { controller, mode: 'shadow', by: 'comeback', reason: `comeback ${plan.roots.date}: every controller starts in shadow (§6.2 step 10)` });
    for (const l of plan.ledgers.filter((x) => x.kind === 'project-ledger' && !DROPPED_LEDGERS.includes(x.name))) {
      const product = l.name.replace(/-(backend|be)$/, '');
      const file = w.ledger.ledgerFileFor(l.repo);
      const h = w.ledger.openLedger({ file, repoRoot: l.repo, product });
      const ledgerId = h.ledgerId;
      h.close();
      w.machine.registerLedger(machine, { ledgerId, name: l.name, product, repoRoot: l.repo, file });
      ledgers.push({ name: l.name, repo: l.repo, ledgerId, file });
    }
  } finally { try { machine?.close?.(); } catch { /* closed */ } }
  return { ok: true, ledgers };
}

// ---------------------------------------------------------------------------------------------------------------
// §6.4 post-checks
// ---------------------------------------------------------------------------------------------------------------
function baselineListing(plan) {
  const { roots } = plan;
  const dirs = [roots.supHome, roots.runtimeState, path.join(roots.runtimeRoot, 'runtime', 'guards')];
  const out = {};
  for (const d of dirs) out[slash(d)] = walkFiles(d, { roots, skipDir: (_a, n) => n === 'bin' || n === 'artifacts' }).files.map((f) => slash(f.abs));
  return { at: Date.now(), files: out };
}

const STALE_CODE = /kernel-evidence|settle-parity|settle-tail|\/E\/|draw-loop|new DatabaseSync/;
export async function postChecks(plan, { manifest = readManifest(plan.roots), now = Date.now() } = {}) {
  const checks = [];
  // 1. .starciwork holds §5.1 only (agent data gone; drift reported).
  for (const r of plan.repos) {
    const d = starciworkAgentData(r.repo);
    checks.push({ id: '6.4.1', subject: r.name, ok: d.units.length === 0, detail: `${d.units.length} agent-data path(s), ${d.drift.length} drift file(s) outside §5.1 (legacy layout, kept)` });
  }
  const cites = citationScan(plan).reduce((s, c) => s + c.records.filter((x) => x.done && !x.evidence && x.missing > 0).length, 0);
  checks.push({ id: '6.4.1', subject: 'citations', ok: cites === 0, detail: `${cites} done record(s) still cite agent data that is not ingested` });
  // 2. no old custody path or bare DatabaseSync in scripts/ and ui/ outside engine/.
  const hits = [];
  for (const top of ['scripts', 'ui']) {
    const w = walkFiles(path.join(plan.roots.runtimeRoot, top), { skipDir: (_a, n) => n === 'node_modules' });
    for (const f of w.files) {
      if (!/\.(mjs|js|cjs)$/.test(f.abs) || /comeback\.mjs$|starciwork-boundary\.mjs$/.test(f.abs)) continue;
      if (STALE_CODE.test(fs.readFileSync(f.abs, 'utf8'))) hits.push(slash(path.relative(plan.roots.runtimeRoot, f.abs)));
    }
  }
  checks.push({ id: '6.4.2', subject: 'code', ok: hits.length === 0, detail: `${hits.length} file(s) still name an old custody path or open a bare DatabaseSync${hits.length ? `: ${hits.slice(0, 6).join(', ')}` : ''}` });
  // 3. the smoke workflow is a manual step.
  checks.push({ id: '6.4.3', subject: 'smoke', ok: null, detail: 'run one smoke workflow through the 11 steps of §2.3, then read v_op_history, check_runs, v_media, v_blocking, v_leaks and logs_fts' });
  // 4. no new file in the retired state directories an hour later.
  if (manifest?.postBaseline) {
    const age = now - manifest.postBaseline.at;
    const fresh = [];
    for (const [dir, before] of Object.entries(manifest.postBaseline.files)) {
      const seen = new Set(before);
      for (const f of walkFiles(dir, { skipDir: (_a, n) => n === 'bin' || n === 'artifacts' }).files) {
        const s = slash(f.abs);
        if (!seen.has(s) && !/\/machine\.sqlite(-wal|-shm)?$/.test(s)) fresh.push(s);
      }
    }
    checks.push({ id: '6.4.4', subject: 'no new state files', ok: age < 3_600_000 ? null : fresh.length === 0,
      detail: age < 3_600_000 ? `baseline is ${Math.round(age / 60000)} min old; re-run --post-check after an hour` : `${fresh.length} new file(s)${fresh.length ? `: ${fresh.slice(0, 5).join(', ')}` : ''}` });
  } else checks.push({ id: '6.4.4', subject: 'no new state files', ok: null, detail: 'no baseline: the comeback has not been applied' });
  // 5. blob-sweep dry run.
  try {
    const { planBlobGc } = await import('./blob-gc.mjs');
    const g = await planBlobGc({ now });
    checks.push({ id: '6.4.5', subject: 'blob-sweep dry', ok: g.blocked.length === 0 && g.orphansPastGrace.length === 0,
      detail: `${g.marked} sha marked across ${g.sources.length} source(s); ${g.orphansPastGrace.length} unreferenced blob(s) older than 24 h${g.blocked.length ? `; blocked: ${g.blocked.length} source(s) without blob_ref_columns or unreadable` : ''}` });
  } catch (error) { checks.push({ id: '6.4.5', subject: 'blob-sweep dry', ok: false, detail: String(error?.message ?? error) }); }
  return checks;
}

export function rollbackSteps(plan, manifest = readManifest(plan.roots)) {
  const m = slash(manifestFile(plan.roots));
  return [
    'Before the delete step nothing changed: turn the engine back on and stop.',
    `1. Check out the .claude commit recorded as runtimeRev in ${m}${manifest?.runtimeRev ? ` (${manifest.runtimeRev.slice(0, 12)})` : ''} through a lane.`,
    '2. Stop the engine.',
    `3. Extract every zip listed in ${m}: an entry name is its absolute path with the drive letter as the first segment (D/Repositories/... -> D:/Repositories/...).`,
    '4. git revert the "chore(starciwork): comeback" commit in each product repo (manifest commits[]).',
    '5. git worktree add again from refs/starci/archive/* where a branch is needed (manifest archiveRefs[]).',
    '6. Start the engine.',
    'The comeback zips are archives(kind=comeback, expires_at NULL): GC never removes them without the owner.',
  ];
}

// ---------------------------------------------------------------------------------------------------------------
// output
// ---------------------------------------------------------------------------------------------------------------
function describe(plan, pre, post) {
  const L = [];
  const t = plan.totals;
  L.push(`comeback ${plan.apply ? 'APPLY' : 'dry run'} - archive ${slash(plan.roots.comebackDir)}`);
  L.push(`stores ${human(t.bytes)}: databases ${human(t.dbs)}, state ${human(t.state)}, logs ${human(t.logs)}, .starciwork agent data ${human(t.starciwork)}, worktrees ${human(t.worktrees)}`);
  L.push('', `managed repos: ${plan.repos.map((r) => r.name).join(', ') || 'none'}${plan.unmanaged.length ? ` | unmanaged .starciwork (not touched): ${plan.unmanaged.map((r) => path.basename(r)).join(', ')}` : ''}`);
  L.push('', 'databases (zip, then delete):');
  for (const d of plan.dbs) L.push(`  ${d.label.padEnd(44)} ${human(d.bytes).padStart(9)}  ${slash(d.main)}`);
  if (plan.newMachine) L.push(plan.newMachine.ok ? `  KEPT ${slash(plan.newMachine.file)}: valid alpha.3 machine.sqlite (user_version 1, ${plan.newMachine.tables} tables, quick_check ok) - step 10 opens it, never recreates it`
    : `  ${slash(plan.newMachine.file)} is NOT a valid alpha.3 store (${plan.newMachine.why}): archived and recreated`);
  L.push('', 'state and logs (zip, then delete):');
  const rows = [];
  for (const s of plan.stateLogs) {
    const dir = slash(path.dirname(s.path));
    const last = rows.at(-1);
    if (!s.keep && last && !last.keep && last.dir === dir && last.group === s.group && plan.stateLogs.filter((x) => slash(path.dirname(x.path)) === dir).length > 4) {
      last.n += 1; last.bytes += s.bytes; last.files += s.files; last.label = `${slash(path.dirname(s.label))}/* (${last.n} entries)`; continue;
    }
    rows.push({ ...s, dir, n: 1 });
  }
  for (const s of rows) L.push(`  ${s.group.padEnd(6)} ${String(s.label).padEnd(58)} ${human(s.bytes).padStart(9)} ${String(s.files).padStart(7)} files${s.keep ? `  KEPT: ${s.keep}` : ''}${s.links ? `  ${s.links} link(s) unlinked` : ''}`);
  L.push('', '.starciwork agent data per repo (zip, then delete; product content and drift stay):');
  for (const r of plan.starciwork) {
    const by = {};
    for (const u of r.units) { by[u.category] ??= { n: 0, bytes: 0, files: 0, tracked: 0 }; const b = by[u.category]; b.n += 1; b.bytes += u.bytes; b.files += u.files; b.tracked += u.tracked; }
    L.push(`  ${r.name}: ${r.productFiles} product files kept, ${r.drift} drift file(s) kept${r.drift ? ` (e.g. ${r.driftSample.slice(0, 2).join(', ')})` : ''}`);
    for (const [c, b] of Object.entries(by).sort((a, b2) => b2[1].bytes - a[1].bytes)) L.push(`    ${c.padEnd(16)} ${String(b.n).padStart(5)} path(s) ${String(b.files).padStart(7)} files ${human(b.bytes).padStart(9)}${b.tracked ? `  (${b.tracked} tracked: removed in the comeback commit)` : ''}`);
  }
  L.push('', 'op worktrees and push scratches (zip without node_modules, unlanded commits kept at refs/starci/archive/*, then safe-remove):');
  for (const w of plan.worktrees) L.push(`  ${slash(w.path)}  ${w.branch ?? (w.head ? `detached ${w.head.slice(0, 8)}` : 'unregistered')}  ${human(w.bytes)}${w.unlanded ? `  ${w.unlanded} unlanded` : ''}${w.dirty ? `  ${w.dirty} uncommitted (status + diff archived)` : ''}${w.links ? `  ${w.links} link(s) unlinked` : ''}${w.keep ? `  KEPT: ${w.keep}` : ''}`);
  L.push('', 'Work-record evidence (owner correction: cited evidence is product evidence, ingested and pinned BEFORE any archive):');
  const tot = { files: 0, bytes: 0, citations: 0, records: 0, stale: 0, missing: 0 };
  for (const c of plan.citations) {
    tot.files += c.ingest.files; tot.bytes += c.ingest.bytes; tot.citations += c.ingest.citations; tot.records += c.ingest.records; tot.stale += c.stale.records; tot.missing += c.stale.missingPaths;
    L.push(`  ${c.name}: ingest-pinned ${c.ingest.files} file(s) ${human(c.ingest.bytes)} for ${c.ingest.citations} citation(s) in ${c.ingest.records} record(s); stale ${c.stale.records} record(s) (${c.stale.missingPaths} missing path(s): ${c.stale.demote} done index.yaml -> todo, ${c.stale.markStale} evidence.yaml stale)`);
  }
  const archiveDelete = plan.totals.bytes - tot.bytes;
  L.push(`  totals: ingest-pinned ${tot.files} file(s) ${human(tot.bytes)} | stale ${tot.stale} record(s), ${tot.missing} missing path(s) | archive-delete ${human(archiveDelete)} (everything else above, ingested originals included once pinned)`);
  L.push('', 'fresh databases (step 10): machine.sqlite with every controller in shadow; runtime.sqlite for ' + plan.ledgers.filter((l) => l.kind === 'project-ledger' && !DROPPED_LEDGERS.includes(l.name)).map((l) => l.name).join(', ') + ' under %LOCALAPPDATA%/StarCi/projects/<ledger_id>/ (Q1), registered in machine.ledgers');
  L.push('', `relaunch (${plan.relaunch.list.length}), goal text from the archived ledger; each: define-goal (owner ok at the entry gate) then start-kernel:`);
  for (const r of plan.relaunch.list) {
    L.push(`  - ${r.workflowId} [${r.ledger}] ${r.displayName ?? r.title ?? ''} (goal rev ${r.goalRevision ?? '?'})`);
    for (const line of String(r.goal ?? '(no goal row)').split(/\r?\n/).slice(0, 12)) L.push(`      | ${line}`);
    if (String(r.goal ?? '').split(/\r?\n/).length > 12) L.push(`      | ... full text: ${slash(path.join(plan.roots.comebackDir, 'relaunch', `${r.workflowId}.md`))}`);
    L.push(`      node scripts/goal/define-goal.mjs --repo ${slash(r.repo)} --title ${JSON.stringify(r.title ?? r.workflowId)} --text "<the goal text above>"`);
  }
  for (const x of plan.relaunch.excluded) L.push(`  x ${x.workflowId} [${x.ledger}]: ${x.why}`);
  if (pre) {
    L.push('', `preconditions: ${pre.ok ? 'met' : 'NOT met - --apply refuses'}`);
    for (const b of pre.blockers) L.push(`  ! ${b}`);
    for (const n of pre.notes) L.push(`  . ${n}`);
  }
  L.push('', 'rollback (§6.3):', ...rollbackSteps(plan).map((s) => `  ${s}`));
  if (post) { L.push('', 'post-checks (§6.4):'); for (const c of post) L.push(`  [${c.ok === true ? 'ok' : c.ok === false ? 'FAIL' : ' .. '}] ${c.id} ${c.subject}: ${c.detail}`); }
  return L.join('\n');
}

export function parseArgs(argv) {
  const o = { apply: false, json: false, postCheck: false, repos: [] };
  const take = (i) => argv[i + 1];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--apply') o.apply = true;
    else if (a === '--json') o.json = true;
    else if (a === '--post-check') o.postCheck = true;
    else if (a === '--repo') { o.repos.push(take(i)); i += 1; }
    else if (a.startsWith('--')) {
      const key = a.slice(2).replace(/-([a-z])/g, (_m, c) => c.toUpperCase());
      if (!['date', 'home', 'localAppData', 'supervisorHome', 'runtimeRoot', 'reposRoot', 'lanesRoot', 'pushScratchRoot', 'archiveRoot'].includes(key)) throw new Error(`unknown option ${a}`);
      o[key] = take(i); i += 1;
    }
  }
  return o;
}

async function main(argv) {
  const opts = parseArgs(argv);
  const plan = buildPlan(opts);
  if (opts.postCheck) {
    const post = await postChecks(plan);
    if (opts.json) console.log(JSON.stringify({ postChecks: post }, null, 2));
    else console.log(post.map((c) => `[${c.ok === true ? 'ok' : c.ok === false ? 'FAIL' : ' .. '}] ${c.id} ${c.subject}: ${c.detail}`).join('\n'));
    return post.every((c) => c.ok !== false) ? 0 : 1;
  }
  if (!opts.apply) {
    const pre = await preconditions(plan);
    const post = await postChecks(plan);
    if (opts.json) console.log(JSON.stringify({ ...plan, preconditions: pre, rollback: rollbackSteps(plan), postChecks: post }, null, 2));
    else console.log(describe(plan, pre, post));
    return 0;
  }
  const out = await applyComeback(plan, { log: (l) => { if (!opts.json) console.log(l); } });
  const post = out.ok ? await postChecks(plan) : null;
  if (opts.json) console.log(JSON.stringify({ ...out, postChecks: post, rollback: rollbackSteps(plan) }, null, 2));
  else {
    if (out.refused) console.log(`refused:\n${out.blockers.map((b) => `  ! ${b}`).join('\n')}`);
    else console.log(describe(plan, null, post));
  }
  return out.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (error) => { console.error(error?.stack ?? error); process.exitCode = 2; });
}
