// scripts/agent/trust.mjs — pre-trust the directory a Claude/Codex agent is
// launched in, so the runtime (never the owner) answers the launch prompts.
//
// Owner instruction, 2026-09-23: the owner is never the one approving launch
// prompts; the runtime approves them. The owner authorised automatic trust for
// every directory the runtime launches Claude/Codex agents in.
//
//   ensureLaunchTrust({ agent, cwd })
//   SCOPE (lead ruling 2026-10-01): the command guard hook and every launch setting are written to the launch
//   worktree's PROJECT files (projectTargets), never to a user-global settings file, so they reach only the agents
//   the runtime starts in that worktree; each such file is kept out of git status through the repository's own
//   info/exclude (excludeFromGit). The only per-user records are the ones a host keeps nowhere else: its trust of
//   the directory, and Codex's trusted hash of the project hook.
//     claude → ~/.claude.json projects[<cwd>].hasTrustDialogAccepted = true, in
//              every key form Claude writes (win32: `D:/…` and `D:\…`); in
//              <cwd>/.claude/settings.local.json: skipDangerousModePermissionPrompt
//              (set only when missing), each agents/claude.yaml launchEnv key under
//              env (DISABLE_AUTOUPDATER: Orca composes a worker's command, so its
//              launch env cannot carry it) and the guard hook.
//     codex  → [projects."<path>"] trust_level = "trusted" in every Codex home
//              (CODEX_HOME, ~/.codex, Orca's codex-runtime-home) for the launch
//              cwd and the git root Codex keys trust by, in the key forms Codex
//              writes (win32: 'd:\lower\case' literal and "D:\\Exact" basic), plus the
//              update-check and model-nudge notices; the guard hook in the project
//              layer <cwd>/.codex/config.toml, and in each home only the hash Codex
//              trusts it by (codex app-server hooks/list, then config/batchWrite
//              hooks.state - the way Orca trusts its own hooks).
//     devin  → <cwd>/.devin/config.local.json (Devin's local project config): the
//              guard hook and agent.model pinned to the routed model, which
//              worker-start cannot pass to Devin.
//   Returns the receipt the launch event records:
//     {agent, paths, status: written|already|skipped|failed, written[], already[], …}
//
// Both files are rewritten by running agent sessions, so every write is a
// read-modify-write with an atomic rename, re-read and verified; a lost update
// is retried a bounded number of times. Only the named project keys change —
// every other field/table (and TOML comments) is kept. A test process
// (NODE_TEST_CONTEXT) never touches the real files: it writes only under
// STARCI_AGENT_TRUST_HOME, or skips.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseYaml } from '../../engine/yaml.mjs';
import { runGit } from '../api/git/lib.mjs';
import { renameOver } from '../api/fs/rename-over.mjs';
import { sleepSync } from '../lib/sleep-sync.mjs';
import { parseJson } from '../lib/json.mjs';

const CLAUDE_CARD = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'modules', 'models', 'agents', 'claude.yaml');

const TRUST_AGENTS = new Set(['claude', 'codex', 'devin']);
const ATTEMPTS = 5;

/* ---------------------------------------------------------------- targets */

/** Orca's CODEX_HOME: <Electron userData>/codex-runtime-home/home, resolved the way Orca does. */
export function orcaCodexHome({ env = process.env, platform = process.platform, home = os.homedir() } = {}) {
  if (env.STARCI_ORCA_CODEX_HOME) return env.STARCI_ORCA_CODEX_HOME;
  const appData = platform === 'win32'
    ? (env.APPDATA || path.join(home, 'AppData', 'Roaming'))
    : platform === 'darwin'
      ? path.join(home, 'Library', 'Application Support')
      : (env.XDG_CONFIG_HOME || path.join(home, '.config'));
  return path.join(appData, 'orca', 'codex-runtime-home', 'home');
}

/**
 * The files trust is written to. STARCI_AGENT_TRUST_HOME re-roots every one of
 * them (specs); otherwise Claude's own CLAUDE_CONFIG_DIR and Codex's CODEX_HOME
 * are honoured. Returns {claudeJson, claudeSettings, codexHomes[], skipped?}.
 */
export function trustTargets({ env = process.env, platform = process.platform } = {}) {
  const root = env.STARCI_AGENT_TRUST_HOME || null;
  if (!root && env.NODE_TEST_CONTEXT)
    return { skipped: 'a test process writes agent trust only under STARCI_AGENT_TRUST_HOME' };
  const home = root || os.homedir();
  const claudeDir = !root && env.CLAUDE_CONFIG_DIR ? env.CLAUDE_CONFIG_DIR : null;
  const codexHomes = [];
  const addHome = (kind, dir) => {
    if (!dir) return;
    const key = path.resolve(dir).toLowerCase();
    if (!codexHomes.some((h) => path.resolve(h.dir).toLowerCase() === key)) codexHomes.push({ kind, dir: path.resolve(dir) });
  };
  if (!root) addHome('CODEX_HOME', env.CODEX_HOME);
  addHome('codex-home', path.join(home, '.codex'));
  addHome('orca-codex-home', root
    ? orcaCodexHome({ env: { APPDATA: path.join(root, 'AppData', 'Roaming'), XDG_CONFIG_HOME: path.join(root, '.config') }, platform, home: root })
    : orcaCodexHome({ env, platform, home }));
  return {
    claudeJson: claudeDir ? path.join(claudeDir, '.claude.json') : path.join(home, '.claude.json'),
    codexHomes,
  };
}

/**
 * The PROJECT-scoped files of the launch directory `dir` (never a user-global file): Claude's local project settings,
 * Codex's project config layer and Devin's local project config. They carry the command guard hook and each host's
 * launch settings, so they apply only to agents started in that worktree.
 */
export const projectTargets = (dir) => ({
  claudeSettings: path.join(dir, '.claude', 'settings.local.json'),
  codexConfig: path.join(dir, '.codex', 'config.toml'),
  devinConfig: path.join(dir, '.devin', 'config.local.json'),
});

/**
 * Keep a project file the runtime wrote out of `git status`: its path (relative to the checkout's top level) goes in
 * the repository's own info/exclude (`git rev-parse --git-path info/exclude`), never a user-global ignore. A directory
 * that is no git checkout, or a file git already tracks, is left alone. Returns {file, state} or null.
 */
export function excludeFromGit(dir, file) {
  const topOut = runGit(['rev-parse', '--show-toplevel'], { cwd: dir });
  const excludeOut = runGit(['rev-parse', '--path-format=absolute', '--git-path', 'info/exclude'], { cwd: dir });
  if (topOut?.status !== 0 || excludeOut?.status !== 0) return null;
  const top = String(topOut.stdout).trim();
  const rel = path.relative(top, file).split(path.sep).join('/');
  if (!rel || rel.startsWith('..')) return null;
  if (runGit(['ls-files', '--error-unmatch', '--', rel], { cwd: top })?.status === 0) return { file: rel, state: 'tracked' };
  const target = String(excludeOut.stdout).trim();
  const line = '/' + rel;
  let text = '';
  try { text = fs.readFileSync(target, 'utf8'); } catch { text = ''; }
  if (text.split(/\r?\n/).includes(line)) return { file: rel, state: 'already' };
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.appendFileSync(target, (text && !text.endsWith('\n') ? '\n' : '') + line + '\n');
  return { file: rel, state: 'written' };
}

/* -------------------------------------------------------------- key forms */

const upperDrive = (p) => p.replace(/^([a-z]):/, (m, d) => `${d.toUpperCase()}:`);

/** Claude's project keys for `dir`: win32 writes both `D:/…` and `D:\…`. */
export function claudeKeyForms(dir, platform = process.platform) {
  if (platform !== 'win32') return [path.posix.resolve(String(dir))];
  const abs = upperDrive(path.win32.resolve(String(dir)));
  return [...new Set([abs.replaceAll('\\', '/'), abs.replaceAll('/', '\\')])];
}

/** Codex's project keys for `dir`: win32 writes 'd:\lower' (its own form) and "D:\\Exact". */
export function codexKeyForms(dir, platform = process.platform) {
  if (platform !== 'win32') return [path.posix.resolve(String(dir))];
  const abs = upperDrive(path.win32.resolve(String(dir))).replaceAll('/', '\\');
  return [...new Set([abs.toLowerCase(), abs])];
}

/** Paths Codex keys trust by: the cwd, its git toplevel and the main worktree root. */
export function codexTrustPaths(cwd) {
  const out = [path.resolve(cwd)];
  const git = (...args) => {
    try {
      const r = runGit(args, { dir: cwd, timeout: 10000 });
      return r.status === 0 ? r.stdout.trim() : null;
    } catch { return null; }
  };
  const top = git('rev-parse', '--show-toplevel');
  if (top) out.push(path.resolve(top));
  const common = git('rev-parse', '--path-format=absolute', '--git-common-dir');
  if (common && path.basename(common) === '.git') out.push(path.resolve(path.dirname(common)));
  const seen = new Set();
  return out.filter((p) => { const k = p.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}

/* ------------------------------------------------------ atomic rewriting */

const readText = (file) => { try { return fs.readFileSync(file, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } };

/**
 * Read-modify-write `file` with an atomic rename, then re-read and verify.
 *   transform(text|null) → {text: next|null (no change needed), result}
 *   verify(text) → true when the change is on disk
 * A concurrent rewrite between read and rename, or one that lands after the
 * rename and drops the change, is a lost update: retried up to `attempts`.
 * hooks.beforeRename / hooks.afterRename let specs simulate that writer.
 */
export function atomicUpdate(file, transform, verify, { attempts = ATTEMPTS, hooks = {} } = {}) {
  const trail = [];
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const before = readText(file);
    const { text: next, result } = transform(before);
    if (next == null) {
      if (verify(before)) return { ok: true, changed: false, attempts: attempt, trail, result };
      return { ok: false, error: 'transform produced no change but verification failed', attempts: attempt, trail };
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.starci-trust-${process.pid}-${Date.now()}-${attempt}.tmp`;
    fs.writeFileSync(tmp, next);
    try {
      hooks.beforeRename?.({ attempt, file });
      if (readText(file) !== before) { trail.push({ attempt, lost: 'rewritten-before-rename' }); continue; }
      renameOver(tmp, file, { delayMs: (i) => 25 * (i + 1) });
    } finally { try { fs.rmSync(tmp, { force: true }); } catch { /* best-effort */ } }
    hooks.afterRename?.({ attempt, file });
    const onDisk = readText(file);
    if (onDisk != null && verify(onDisk)) return { ok: true, changed: true, attempts: attempt, trail, result };
    trail.push({ attempt, lost: 'overwritten-after-rename' });
    sleepSync(20 * attempt);
  }
  return { ok: false, error: `lost update: ${file} was rewritten on each of ${attempts} attempts`, attempts, trail };
}

/* ------------------------------------------------------------------ claude */

// The project shape Claude itself writes for a new directory.
const CLAUDE_PROJECT_DEFAULT = () => ({
  allowedTools: [], mcpContextUris: [], mcpServers: {}, enabledMcpjsonServers: [], disabledMcpjsonServers: [],
  hasTrustDialogAccepted: true, hasClaudeMdExternalIncludesApproved: false, hasClaudeMdExternalIncludesWarningShown: false,
});

// JSON.parse → stringify is exact for every value except integers past 2^53.
// Refuse to rewrite a file whose long number literals would not survive.
const longNumbers = (text) => (text.match(/(?<![\w."])-?\d{16,}(?:\.\d+)?(?:[eE][+-]?\d+)?(?![\w"])/g) ?? []);
const numbersSurvive = (before, after) => longNumbers(before).every((n) => after.includes(n));

const jsonOf = (text) => parseJson(text, undefined);

/** Set projects[key].hasTrustDialogAccepted = true for every key in `file` (~/.claude.json). */
export function writeClaudeTrust({ file, keys, hooks }) {
  const verify = (text) => {
    const doc = text == null ? null : jsonOf(text);
    return !!doc && keys.every((k) => doc.projects?.[k]?.hasTrustDialogAccepted === true);
  };
  const out = { file, written: [], already: [] };
  const updated = atomicUpdate(file, (text) => {
    const doc = text == null ? {} : jsonOf(text);
    if (doc === undefined || !doc || typeof doc !== 'object' || Array.isArray(doc))
      throw new Error(`${file} is not a JSON object; refusing to rewrite it`);
    const written = [], already = [];
    if (!doc.projects || typeof doc.projects !== 'object') doc.projects = {};
    for (const key of keys) {
      const existing = doc.projects[key];
      if (existing?.hasTrustDialogAccepted === true) { already.push(key); continue; }
      doc.projects[key] = existing && typeof existing === 'object' ? { ...existing, hasTrustDialogAccepted: true } : CLAUDE_PROJECT_DEFAULT();
      written.push(key);
    }
    if (!written.length) return { text: null, result: { written, already } };
    const next = JSON.stringify(doc, null, 2) + (text?.endsWith('\n') ? '\n' : '');
    if (text && !numbersSurvive(text, next)) throw new Error(`${file} holds a number JSON cannot round-trip; refusing to rewrite it`);
    return { text: next, result: { written, already } };
  }, verify, { hooks });
  if (!updated.ok) return { ...out, ok: false, error: updated.error, trail: updated.trail };
  out.written = updated.result.written;
  out.already = updated.result.already;
  return { ...out, ok: true, attempts: updated.attempts, ...(updated.trail.length ? { trail: updated.trail } : {}) };
}

/** Assert skipDangerousModePermissionPrompt in Claude's settings.json; set it only when missing. */
export function assertClaudeBypassConsent({ file, hooks }) {
  const current = readText(file);
  const doc = current == null ? {} : jsonOf(current);
  if (doc === undefined || !doc || typeof doc !== 'object') return { file, ok: false, state: 'unreadable' };
  if (doc.skipDangerousModePermissionPrompt === true) return { file, ok: true, state: 'already' };
  if ('skipDangerousModePermissionPrompt' in doc) return { file, ok: true, state: 'owner-set-false' };
  const updated = atomicUpdate(file, (text) => {
    const d = text == null ? {} : jsonOf(text);
    if (d === undefined || !d || typeof d !== 'object') throw new Error(`${file} is not a JSON object`);
    if ('skipDangerousModePermissionPrompt' in d) return { text: null, result: null };
    d.skipDangerousModePermissionPrompt = true;
    return { text: JSON.stringify(d, null, 2) + (text?.endsWith('\n') ? '\n' : ''), result: null };
  }, (text) => jsonOf(text ?? '')?.skipDangerousModePermissionPrompt !== undefined, { hooks });
  return updated.ok ? { file, ok: true, state: updated.changed ? 'written' : 'already' } : { file, ok: false, state: 'failed', error: updated.error };
}

/** agents/claude.yaml launchEnv: {KEY: 'value'} (string values only), or {} when the card has none. */
export function claudeLaunchEnv({ file = CLAUDE_CARD } = {}) {
  try {
    const vars = parseYaml(fs.readFileSync(file, 'utf8'))?.launchEnv;
    if (!vars || typeof vars !== 'object' || Array.isArray(vars)) return {};
    return Object.fromEntries(Object.entries(vars).filter(([k, v]) => /^[A-Z_][A-Z0-9_]*$/.test(k) && v != null).map(([k, v]) => [k, String(v)]));
  } catch { return {}; }
}

/**
 * Assert each `vars` key under settings.json env; set only the keys that are missing (an owner-set value, even a
 * different one, is kept). Returns {file, ok, state: written|already|owner-set|unreadable|failed, owner?: [keys]}.
 */
export function assertClaudeSettingsEnv({ file, vars, hooks }) {
  const keys = Object.keys(vars ?? {});
  if (!keys.length) return { file, ok: true, state: 'already' };
  const current = readText(file);
  const doc = current == null ? {} : jsonOf(current);
  if (doc === undefined || !doc || typeof doc !== 'object' || Array.isArray(doc)) return { file, ok: false, state: 'unreadable' };
  if (doc.env != null && (typeof doc.env !== 'object' || Array.isArray(doc.env))) return { file, ok: false, state: 'unreadable' };
  const has = (d, k) => d.env && typeof d.env === 'object' && Object.hasOwn(d.env, k);
  const owner = keys.filter((k) => has(doc, k) && String(doc.env[k]) !== vars[k]);
  const missing = keys.filter((k) => !has(doc, k));
  if (!missing.length) return { file, ok: true, state: owner.length ? 'owner-set' : 'already', ...(owner.length ? { owner } : {}) };
  const updated = atomicUpdate(file, (text) => {
    const d = text == null ? {} : jsonOf(text);
    if (d === undefined || !d || typeof d !== 'object' || Array.isArray(d)) throw new Error(`${file} is not a JSON object`);
    const add = keys.filter((k) => !has(d, k));
    if (!add.length) return { text: null, result: null };
    d.env = { ...(d.env && typeof d.env === 'object' ? d.env : {}), ...Object.fromEntries(add.map((k) => [k, vars[k]])) };
    return { text: JSON.stringify(d, null, 2) + (text?.endsWith('\n') ? '\n' : ''), result: null };
  }, (text) => { const d = jsonOf(text ?? ''); return !!d && keys.every((k) => has(d, k)); }, { hooks });
  return updated.ok ? { file, ok: true, state: updated.changed ? 'written' : 'already', ...(owner.length ? { owner } : {}) }
    : { file, ok: false, state: 'failed', error: updated.error };
}

/* ------------------------------------------------------------------- codex */

// A TOML key segment: bare, 'literal' or "basic" (with escapes).
const KEY_SEG = String.raw`(?:[A-Za-z0-9_-]+|'[^'\r\n]*'|"(?:[^"\\\r\n]|\\.)*")`;
const PROJECT_HEADER = new RegExp(String.raw`^[ \t]*\[[ \t]*projects[ \t]*\.[ \t]*(${KEY_SEG})[ \t]*\][ \t]*(?:#.*)?$`);
const ANY_HEADER = /^[ \t]*\[/;
const TRUST_LINE = /^([ \t]*trust_level[ \t]*=[ \t]*)("(?:[^"\\]|\\.)*"|'[^']*')(.*)$/;

const decodeKey = (seg) => {
  if (seg.startsWith("'")) return seg.slice(1, -1);
  if (!seg.startsWith('"')) return seg;
  return seg.slice(1, -1).replace(/\\(u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|.)/g, (m, e) => {
    if (e[0] === 'u' || e[0] === 'U') return String.fromCodePoint(parseInt(e.slice(1), 16));
    return { b: '\b', t: '\t', n: '\n', f: '\f', r: '\r', '"': '"', '\\': '\\' }[e] ?? e;
  });
};
const decodeValue = (v) => (v.startsWith("'") ? v.slice(1, -1) : decodeKey(v));

/** The header Codex would write for `key`: a literal for its lowercase form, else a basic string. */
export function codexHeader(key) {
  const literal = !/['\r\n]/.test(key) && key === key.toLowerCase() && key.includes('\\');
  return literal ? `[projects.'${key}']` : `[projects."${key.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"]`;
}

/** {key → {header line index, trust line index|null, trust value|null, end}} for every [projects.<key>] table. */
export function codexProjectTables(text) {
  const lines = String(text ?? '').split('\n');
  const tables = new Map();
  let current = null;
  lines.forEach((line, i) => {
    const bare = line.replace(/\r$/, '');
    const m = PROJECT_HEADER.exec(bare);
    if (m) { current = { key: decodeKey(m[1]), header: i, trustLine: null, trust: null, end: i }; if (!tables.has(current.key)) tables.set(current.key, current); return; }
    if (ANY_HEADER.test(bare)) { current = null; return; }
    if (!current) return;
    if (bare.trim()) current.end = i;
    const t = TRUST_LINE.exec(bare);
    if (t && current.trustLine === null) { current.trustLine = i; current.trust = decodeValue(t[2]); }
  });
  return tables;
}

/** Ensure trust_level = "trusted" for every key in a Codex config.toml. Appends; edits only an untrusted table's own line. */
export function writeCodexTrust({ file, keys, hooks }) {
  const verify = (text) => {
    const tables = codexProjectTables(text ?? '');
    return keys.every((k) => tables.get(k)?.trust === 'trusted');
  };
  const out = { file, written: [], already: [] };
  const updated = atomicUpdate(file, (text) => {
    const source = text ?? '';
    const eol = source.includes('\r\n') ? '\r\n' : '\n';
    const tables = codexProjectTables(source);
    const lines = source.split('\n');
    const written = [], already = [], append = [];
    const inserts = [];
    for (const key of keys) {
      const table = tables.get(key);
      if (table?.trust === 'trusted') { already.push(key); continue; }
      written.push(key);
      if (!table) { append.push(key); continue; }
      if (table.trustLine !== null) {
        const cr = lines[table.trustLine].endsWith('\r') ? '\r' : '';
        const m = TRUST_LINE.exec(lines[table.trustLine].replace(/\r$/, ''));
        lines[table.trustLine] = `${m[1]}"trusted"${m[3]}${cr}`;
      } else inserts.push(table.header);
    }
    if (!written.length) return { text: null, result: { written, already } };
    for (const at of inserts.sort((a, b) => b - a)) lines.splice(at + 1, 0, `trust_level = "trusted"${eol === '\r\n' ? '\r' : ''}`);
    let next = lines.join('\n');
    if (append.length) {
      if (next && !next.endsWith('\n')) next += eol;
      for (const key of append) next += `${next ? eol : ''}${codexHeader(key)}${eol}trust_level = "trusted"${eol}`;
    }
    return { text: next, result: { written, already } };
  }, verify, { hooks });
  if (!updated.ok) return { ...out, ok: false, error: updated.error, trail: updated.trail };
  out.written = updated.result.written;
  out.already = updated.result.already;
  return { ...out, ok: true, attempts: updated.attempts, ...(updated.trail.length ? { trail: updated.trail } : {}) };
}

// A new Codex release turned every fresh Codex launch into an interactive
// "Update available! … Press enter to continue" menu: eighteen op launches in
// three workflows failed readiness or model attestation in three hours while
// the kernels, started before the release, kept working. The launch must
// never wait on it, so the top-level check_for_update_on_startup is pinned
// false in every Codex home, like trust.
const UPDATE_CHECK_LINE = /^[ \t]*check_for_update_on_startup[ \t]*=.*$/m;
const topLevelOf = (text) => { const at = String(text ?? '').search(/^[ \t]*\[/m); return at < 0 ? String(text ?? '') : String(text ?? '').slice(0, at); };
export function writeCodexNoUpdateCheck({ file, hooks }) {
  const verify = (text) => /^[ \t]*check_for_update_on_startup[ \t]*=[ \t]*false[ \t]*(?:#.*)?\r?$/m.test(topLevelOf(text));
  const updated = atomicUpdate(file, (text) => {
    const source = text ?? '';
    if (verify(source)) return { text: null, result: { written: false } };
    const eol = source.includes('\r\n') ? '\r\n' : '\n';
    const top = topLevelOf(source);
    // An existing key is flipped in place; a new one closes the top-level block,
    // so the owner's own leading keys stay where they were.
    const head = top && !top.endsWith('\n') ? `${top}${eol}` : top;
    const next = UPDATE_CHECK_LINE.test(top)
      ? top.replace(UPDATE_CHECK_LINE, 'check_for_update_on_startup = false') + source.slice(top.length)
      : `${head}check_for_update_on_startup = false${eol}${source.slice(top.length)}`;
    return { text: next, result: { written: true } };
  }, verify, { hooks });
  if (!updated.ok) return { file, ok: false, error: updated.error };
  return { file, ok: true, written: updated.result.written };
}

// Codex's quota nudge ("Approaching rate limits - Switch to <cheaper model>?") stopped a Collab interface.draw op
// at its menu (2026-09-24). Owner: always keep the current model and never show it again - the answer Codex
// itself records as [notice] hide_rate_limit_model_nudge = true, pinned in every Codex home.
const NUDGE_LINE = /^[ \t]*hide_rate_limit_model_nudge[ \t]*=.*$/m;
const noticeTable = (text) => {
  const at = text.search(/^[ \t]*\[notice\][ \t]*(?:#.*)?\r?$/m);
  if (at < 0) return null;
  const bodyAt = text.indexOf('\n', at) + 1 || text.length;
  const next = text.slice(bodyAt).search(/^[ \t]*\[/m);
  return { bodyAt, end: next < 0 ? text.length : bodyAt + next };
};
export function writeCodexNoModelNudge({ file, hooks }) {
  const verify = (text) => {
    const table = noticeTable(String(text ?? ''));
    return Boolean(table) && /^[ \t]*hide_rate_limit_model_nudge[ \t]*=[ \t]*true[ \t]*(?:#.*)?\r?$/m.test(String(text).slice(table.bodyAt, table.end));
  };
  const updated = atomicUpdate(file, (text) => {
    const source = text ?? '';
    if (verify(source)) return { text: null, result: { written: false } };
    const eol = source.includes('\r\n') ? '\r\n' : '\n';
    const table = noticeTable(source);
    let next;
    if (table) {
      const body = source.slice(table.bodyAt, table.end);
      const fixed = NUDGE_LINE.test(body) ? body.replace(NUDGE_LINE, 'hide_rate_limit_model_nudge = true') : `hide_rate_limit_model_nudge = true${eol}${body}`;
      next = source.slice(0, table.bodyAt) + fixed + source.slice(table.end);
    } else {
      const base = source && !source.endsWith('\n') ? `${source}${eol}` : source;
      next = `${base}${base ? eol : ''}[notice]${eol}hide_rate_limit_model_nudge = true${eol}`;
    }
    return { text: next, result: { written: true } };
  }, verify, { hooks });
  if (!updated.ok) return { file, ok: false, error: updated.error };
  return { file, ok: true, written: updated.result.written };
}

/* ------------------------------------------------------ the command guard */

const GUARD_SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'guards', 'command-guard.mjs');
export const TOOL_GUARD_MARKER = 'command-guard.mjs';
/** The hook command every host runs: forward slashes, since Claude and Devin run hooks through Git Bash on Windows. */
export const toolGuardCommand = (script = GUARD_SCRIPT) => `node "${String(script).replace(/\\/g, '/')}"`;
const isGuardHandler = (h) => typeof h?.command === 'string' && h.command.includes(TOOL_GUARD_MARKER);
const isGuardGroup = (g) => Array.isArray(g?.hooks) && g.hooks.some(isGuardHandler);

/**
 * Ensure hooks.PreToolUse of a Claude-format JSON config (Claude's settings.json, Devin's config.json) holds exactly
 * one command-guard group: {matcher?, hooks: [{type: command, command, timeout}]}. An older guard group (another
 * runtime path) is replaced; every other hook is kept. `edit(doc)` -> true when it changed doc, in the same write.
 */
export function assertJsonToolGuard({ file, command, matcher = null, edit = null, hooks }) {
  const group = { ...(matcher ? { matcher } : {}), hooks: [{ type: 'command', command, timeout: 30 }] };
  const holds = (d) => {
    const list = Array.isArray(d?.hooks?.PreToolUse) ? d.hooks.PreToolUse.filter(isGuardGroup) : [];
    return list.length === 1 && JSON.stringify(list[0]) === JSON.stringify(group);
  };
  let updated;
  try { updated = atomicUpdate(file, (text) => {
    const d = text == null ? {} : jsonOf(text);
    if (d === undefined || !d || typeof d !== 'object' || Array.isArray(d)) throw new Error(`${file} is not a JSON object`);
    if (d.hooks != null && (typeof d.hooks !== 'object' || Array.isArray(d.hooks))) throw new Error(`${file} hooks is not an object`);
    const edited = edit ? edit(d) : false;
    if (holds(d) && !edited) return { text: null, result: null };
    d.hooks = { ...(d.hooks ?? {}) };
    const others = Array.isArray(d.hooks.PreToolUse) ? d.hooks.PreToolUse.filter((g) => !isGuardGroup(g)) : [];
    d.hooks.PreToolUse = [...others, group];
    const next = JSON.stringify(d, null, 2) + (text?.endsWith('\n') ? '\n' : '');
    if (text && !numbersSurvive(text, next)) throw new Error(`${file} holds a number JSON cannot round-trip; refusing to rewrite it`);
    return { text: next, result: null };
  }, (text) => { const d = jsonOf(text ?? ''); return !!d && holds(d) && (!edit || !edit(structuredClone(d))); }, { hooks }); }
  catch (e) { return { file, ok: false, state: 'failed', error: String(e?.message ?? e) }; }
  return updated.ok ? { file, ok: true, state: updated.changed ? 'written' : 'already' } : { file, ok: false, state: 'failed', error: updated.error };
}

/** Devin's config.json: agent.model pinned to `model` (worker-start passes no model to Devin) and the command guard. */
export function writeDevinProfile({ file, command, model = null, hooks }) {
  const pin = (d) => {
    if (!model || d.agent?.model === model) return false;
    if (d.agent != null && (typeof d.agent !== 'object' || Array.isArray(d.agent))) throw new Error(`${file} agent is not an object`);
    d.agent = { ...(d.agent ?? {}), model };
    return true;
  };
  return { ...assertJsonToolGuard({ file, command, edit: pin, hooks }), ...(model ? { model } : {}) };
}

// A Codex hook lives in the home's config.toml as an array-of-tables block the runtime owns, marked on its first line.
const CODEX_GUARD_BEGIN = '# starci-command-guard (scripts/agent/trust.mjs): the op command guard, a PreToolUse hook';
export function codexGuardBlock(command, eol = '\n') {
  const q = (v) => `"${String(v).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
  return [CODEX_GUARD_BEGIN, '[[hooks.PreToolUse]]', 'matcher = "^Bash$"', '', '[[hooks.PreToolUse.hooks]]', 'type = "command"', `command = ${q(command)}`, 'timeout = 30', ''].join(eol);
}
/** Put the guard block in a Codex config.toml: appended, or an older block (another runtime path) replaced in place. */
export function writeCodexToolGuard({ file, command, hooks }) {
  const eolOf = (text) => (String(text ?? '').includes('\r\n') ? '\r\n' : '\n');
  const verify = (text) => String(text ?? '').includes(codexGuardBlock(command, eolOf(text)));
  const updated = atomicUpdate(file, (text) => {
    const source = text ?? '';
    if (verify(source)) return { text: null, result: { written: false } };
    const eol = eolOf(source);
    const at = source.indexOf(CODEX_GUARD_BEGIN);
    if (at >= 0) {
      // The block ends at the first table header that is not its own.
      const rest = source.slice(at);
      const end = /^[ \t]*\[(?!\[hooks\.PreToolUse(?:\.hooks)?\]\])/m.exec(rest);
      return { text: source.slice(0, at) + codexGuardBlock(command, eol) + (end ? eol + rest.slice(end.index) : ''), result: { written: true } };
    }
    const base = source && !source.endsWith('\n') ? `${source}${eol}` : source;
    return { text: `${base}${base ? eol : ''}${codexGuardBlock(command, eol)}`, result: { written: true } };
  }, verify, { hooks });
  return updated.ok ? { file, ok: true, written: updated.result.written } : { file, ok: false, error: updated.error };
}

const APP_SERVER_CLIENT = `
const { spawn } = require('node:child_process');
const reqs = JSON.parse(process.argv[1]);
const p = spawn('codex app-server', { shell: true, stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
const out = []; let buf = ''; let next = 0;
const send = (o) => p.stdin.write(JSON.stringify(o) + '\\n');
const ask = () => { if (next >= reqs.length) { console.log(JSON.stringify(out)); p.kill(); process.exit(0); } send({ id: 100 + next, ...reqs[next] }); };
p.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); let m; try { m = JSON.parse(line); } catch { continue; }
  if (m.id === 1) { send({ method: 'initialized' }); ask(); }
  else if (m.id === 100 + next) { out.push(m.error ? { error: m.error } : m.result); next += 1; ask(); } } });
send({ id: 1, method: 'initialize', params: { clientInfo: { name: 'starci-launch-trust', version: '1' } } });
`;
/**
 * The app-server calls of one Codex home, in order: `requests` [{method, params}] -> results[] (an error result is
 * {error}). Codex computes the hash it trusts a hook by; the runtime asks it, the way Orca trusts its own hooks.
 */
export function codexAppServer({ home, requests, timeoutMs = 60_000 }) {
  const r = spawnSync(process.execPath, ['-e', APP_SERVER_CLIENT, JSON.stringify(requests)], { encoding: 'utf8', timeout: timeoutMs, windowsHide: true,
    env: { ...process.env, CODEX_HOME: home } });
  const results = parseJson(String(r.stdout ?? '').trim().split(/\r?\n/).pop() ?? '', null);
  if (!Array.isArray(results)) throw new Error(`codex app-server answered nothing (exit ${r.status}${r.error ? `: ${r.error.message}` : ''})`);
  return results;
}

/** Trust the guard hook of one Codex home: hooks/list, then hooks.state.<key>.trusted_hash for each untrusted one. */
export function trustCodexToolGuard({ home, cwd, command, appServer = codexAppServer }) {
  const listed = (result) => (result?.data ?? []).flatMap((d) => d?.hooks ?? []).filter((h) => h?.command === command && h?.eventName === 'preToolUse');
  const [before] = appServer({ home, requests: [{ method: 'hooks/list', params: { cwds: [cwd] } }] });
  const entries = listed(before);
  if (!entries.length) return { home, ok: false, error: 'codex hooks/list does not show the command guard' };
  const untrusted = entries.filter((h) => h.trustStatus !== 'trusted');
  if (!untrusted.length) return { home, ok: true, trusted: 'already' };
  const value = Object.fromEntries(untrusted.map((h) => [h.key, { trusted_hash: h.currentHash }]));
  const [, after] = appServer({ home, requests: [
    { method: 'config/batchWrite', params: { edits: [{ keyPath: 'hooks.state', value, mergeStrategy: 'upsert' }], reloadUserConfig: true } },
    { method: 'hooks/list', params: { cwds: [cwd] } }] });
  const still = listed(after).filter((h) => h.trustStatus !== 'trusted');
  return still.length ? { home, ok: false, error: `codex still reports the guard hook ${still[0].trustStatus ?? 'untrusted'}` } : { home, ok: true, trusted: 'written' };
}

/* ------------------------------------------------------------------ launch */

/** The launch cwd as a directory, or null for an Orca selector ('active', 'id:…'). */
export function launchDirectory(worktree) {
  if (typeof worktree !== 'string' || !worktree.trim()) return null;
  const p = worktree.startsWith('path:') ? worktree.slice(5) : worktree;
  try { return fs.statSync(p).isDirectory() ? path.resolve(p) : null; } catch { return null; }
}

/**
 * Pre-trust `cwd` for `agent` before launch. Never throws; a failure is
 * recorded (the gate auto-answer in lib.mjs is the fallback). Returns null for
 * an agent with no trust prompt.
 */
export function ensureLaunchTrust({ agent, cwd, model = null, env = process.env, platform = process.platform, hooks, codexAppServer: appServer = null } = {}) {
  if (!TRUST_AGENTS.has(agent)) return null;
  const dir = launchDirectory(cwd);
  if (!dir) return { agent, paths: [], status: 'skipped', reason: `launch cwd is not a directory: ${cwd ?? 'none'}` };
  const targets = trustTargets({ env, platform });
  if (targets.skipped) return { agent, paths: [dir], status: 'skipped', reason: targets.skipped };
  const project = projectTargets(dir);
  const receipt = { agent, paths: [dir], written: [], already: [], errors: [] };
  const collect = (r) => {
    for (const key of r.written ?? []) receipt.written.push({ file: r.file, key });
    for (const key of r.already ?? []) receipt.already.push({ file: r.file, key });
    if (!r.ok) receipt.errors.push({ file: r.file, error: r.error });
  };
  const guard = (file, fn) => { try { return fn(); } catch (e) { return { file, ok: false, error: String(e?.message ?? e) }; } };
  // A project file the runtime wrote stays out of `git status` (the repository's own info/exclude).
  const excluded = (file) => { const x = guard(file, () => excludeFromGit(dir, file)); if (x) (receipt.gitExclude ??= []).push(x); if (x?.ok === false) receipt.errors.push({ file, error: x.error }); };
  const command = toolGuardCommand();
  if (agent === 'devin') {
    // Devin's LOCAL project config (<dir>/.devin/config.local.json): the guard hook, and the routed model pinned for
    // this worktree alone (worker-start passes Devin no --model).
    const file = project.devinConfig;
    const profile = guard(file, () => writeDevinProfile({ file, command, model, hooks }));
    receipt.toolGuard = [{ file, state: profile.state ?? 'failed' }];
    if (model) receipt.modelPin = { file, model, state: profile.state ?? 'failed' };
    if (!profile.ok) receipt.errors.push({ file, error: profile.error ?? profile.state });
    else if (profile.state === 'written') receipt.written.push({ file, key: model ? 'agent.model,hooks.PreToolUse' : 'hooks.PreToolUse' });
    else receipt.already.push({ file, key: model ? 'agent.model,hooks.PreToolUse' : 'hooks.PreToolUse' });
    if (profile.ok) excluded(file);
  } else if (agent === 'claude') {
    // The directory trust record is Claude's own per-user state (~/.claude.json); everything else is the worktree's
    // local project settings (<dir>/.claude/settings.local.json), which Claude reads for the bypass consent, env and hooks.
    collect(guard(targets.claudeJson, () => writeClaudeTrust({ file: targets.claudeJson, keys: claudeKeyForms(dir, platform), hooks })));
    const file = project.claudeSettings;
    const consent = guard(file, () => assertClaudeBypassConsent({ file, hooks }));
    receipt.bypassConsent = consent.state ?? 'failed';
    if (!consent.ok) receipt.errors.push({ file, error: consent.error ?? consent.state });
    const launchEnv = guard(file, () => assertClaudeSettingsEnv({ file, vars: claudeLaunchEnv(), hooks }));
    receipt.launchEnv = launchEnv.state ?? 'failed';
    if (!launchEnv.ok) receipt.errors.push({ file, error: launchEnv.error ?? launchEnv.state });
    const toolGuard = guard(file, () => assertJsonToolGuard({ file, command, matcher: 'Bash|PowerShell', hooks }));
    receipt.toolGuard = [{ file, state: toolGuard.state ?? 'failed' }];
    if (!toolGuard.ok) receipt.errors.push({ file, error: toolGuard.error ?? toolGuard.state });
    if (consent.ok || launchEnv.ok || toolGuard.ok) excluded(file);
  } else {
    // Codex: the directory trust and the notices live in each Codex home (Codex reads a project layer only for a
    // trusted project); the guard hook lives in the worktree's project layer (<dir>/.codex/config.toml), and each home
    // records only Codex's hash that trusts it (hooks.state, keyed by that project file).
    receipt.paths = codexTrustPaths(dir);
    const keys = [...new Set(receipt.paths.flatMap((p) => codexKeyForms(p, platform)))];
    const homes = targets.codexHomes.filter((home) => fs.existsSync(home.dir));
    for (const home of homes) {
      const file = path.join(home.dir, 'config.toml');
      collect(guard(file, () => writeCodexTrust({ file, keys, hooks })));
      const noUpdate = guard(file, () => writeCodexNoUpdateCheck({ file, hooks }));
      (receipt.updateCheck ??= []).push({ file, off: noUpdate.ok === true, ...(noUpdate.written ? { written: true } : {}), ...(noUpdate.ok ? {} : { error: noUpdate.error }) });
      if (!noUpdate.ok) receipt.errors.push({ file, error: noUpdate.error });
      const noNudge = guard(file, () => writeCodexNoModelNudge({ file, hooks }));
      (receipt.modelNudge ??= []).push({ file, off: noNudge.ok === true, ...(noNudge.written ? { written: true } : {}), ...(noNudge.ok ? {} : { error: noNudge.error }) });
      if (!noNudge.ok) receipt.errors.push({ file, error: noNudge.error });
    }
    const file = project.codexConfig;
    const hook = guard(file, () => writeCodexToolGuard({ file, command, hooks }));
    if (!hook.ok) receipt.errors.push({ file, error: hook.error });
    else { receipt[hook.written ? 'written' : 'already'].push({ file, key: 'hooks.PreToolUse' }); excluded(file); }
    // A re-rooted trust home (specs) never starts the real Codex: its app-server is injected, else the hash step waits.
    const server = appServer ?? (env.STARCI_AGENT_TRUST_HOME ? null : codexAppServer);
    receipt.toolGuard = [{ file, ...(hook.written ? { written: true } : {}), trustedIn: homes.map((home) => {
      const trusted = hook.ok && server ? guard(file, () => trustCodexToolGuard({ home: home.dir, cwd: dir, command, appServer: server })) : null;
      if (trusted && !trusted.ok) receipt.errors.push({ file: path.join(home.dir, 'config.toml'), error: trusted.error });
      return { home: home.dir, trusted: trusted ? (trusted.ok ? trusted.trusted : 'failed') : 'not-checked' };
    }) }];
  }
  receipt.status = receipt.errors.length ? 'failed' : (receipt.written.length ? 'written' : 'already');
  if (!receipt.errors.length) delete receipt.errors;
  return receipt;
}
