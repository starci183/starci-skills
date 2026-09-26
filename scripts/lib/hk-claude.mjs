// hk-claude.mjs — Claude Code transcript archiving (STORAGE-PROMPT.md item 10).
//
// ~/.claude/projects/<project-slug>/*.jsonl is one transcript per Claude Code session. On 2026-09-26 that
// tree held ~2 GB on C: and nothing ever reclaimed it. The sweep moves every transcript older than
// allocation.housekeeping.claudeTranscriptArchiveAfterMs to <archiveRoot>/claude/<project-slug>/<file>
// (the same relative path, one volume over), EXCEPT:
//   - the supervisor's own current session: the newest *.jsonl of the scratch-workspace project — the
//     project directory whose name decodes to a Claude desktop scratch workspace (the chat-mode
//     supervisor lives in the owner's desktop session). STARCI_CLAUDE_SUPERVISOR_PROJECT names the
//     project directly; STARCI_CLAUDE_SUPERVISOR_WORKSPACE names its cwd (slugified the way Claude Code
//     spells it) when the exact slug is not known.
//   - ANY file modified within the last 24 hours (allocation.housekeeping.claudeTranscriptRecentMs
//     when the contract declares one): a session still being written is never moved under its writer.
// Links are never followed or moved through: a link-like project directory or transcript is skipped
// with reason 'link' (isLinkLike from scripts/lib/safe-remove.mjs).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isLinkLike } from './safe-remove.mjs';
import { samePath } from './path-key.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Contract defaults when the injected allocation omits them (runtimes.yaml declares the live values). */
const DEFAULT_ARCHIVE_AFTER_MS = 7 * DAY_MS;
const DEFAULT_RECENT_MS = DAY_MS;
const DEFAULT_ARCHIVE_ROOT = 'D:/starci-archive';

/** The positive number `value` carries, else null. */
const positiveMs = (value) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null);

/** `allocation` may be the full allocationSettings() block or its `housekeeping` sub-block. */
const housekeepingOf = (allocation) => {
  const hk = allocation?.housekeeping ?? allocation;
  return hk && typeof hk === 'object' ? hk : {};
};

/** The directories holding <project-slug>/ transcript folders: STARCI_CLAUDE_PROJECTS_ROOT (a
 *  path.delimiter list) or <USERPROFILE|HOME>/.claude/projects. */
export function claudeProjectsRoots(env = process.env) {
  const override = String(env?.STARCI_CLAUDE_PROJECTS_ROOT ?? '').trim();
  if (override) return override.split(path.delimiter).filter(Boolean).map((p) => path.resolve(p));
  const home = env?.USERPROFILE || env?.HOME || os.homedir();
  return [path.join(home, '.claude', 'projects')];
}

/** Claude Code's project-slug spelling of a cwd: every non-alphanumeric byte becomes '-'. */
export const claudeProjectSlug = (cwd) => String(cwd).replace(/[^a-zA-Z0-9]/g, '-');

/** The project directories under `roots`: [{slug, dir, files:[{name, path, stat}]}], links skipped. */
function projectDirs(roots, out) {
  const dirs = [];
  for (const root of roots) {
    let entries;
    try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch (error) {
      if (error?.code !== 'ENOENT') out.errors.push({ path: root, error: String(error?.message ?? error) });
      continue;
    }
    for (const entry of entries) {
      const dir = path.join(root, entry.name);
      let stat;
      try { stat = fs.lstatSync(dir); } catch (error) { if (error?.code !== 'ENOENT') out.errors.push({ path: dir, error: String(error?.message ?? error) }); continue; }
      // links first: lstat spells a junction/dir-symlink as not-a-directory, so the directory
      // test alone would silently pass a link by instead of reporting it.
      if (isLinkLike(dir, { stat })) { out.skipped.push({ path: dir, reason: 'link' }); continue; }
      if (!stat.isDirectory()) continue;
      const files = [];
      let listing;
      try { listing = fs.readdirSync(dir); } catch (error) { out.errors.push({ path: dir, error: String(error?.message ?? error) }); continue; }
      for (const name of listing) {
        if (!name.endsWith('.jsonl')) continue;
        const file = path.join(dir, name);
        let st;
        try { st = fs.lstatSync(file); } catch (error) { if (error?.code !== 'ENOENT') out.errors.push({ path: file, error: String(error?.message ?? error) }); continue; }
        files.push({ name, path: file, stat: st });
      }
      dirs.push({ slug: entry.name, dir, files });
    }
  }
  return dirs;
}

/**
 * The transcript the supervisor is writing right now: the newest *.jsonl of the scratch-workspace
 * project. `env.STARCI_CLAUDE_SUPERVISOR_PROJECT` pins the slug, `env.STARCI_CLAUDE_SUPERVISOR_WORKSPACE`
 * pins it by cwd; absent both, the scratch-workspaces project holding the newest transcript wins.
 * Returns the file path to exempt, or null.
 */
function supervisorSessionFile(dirs, env, now) {
  let dir = null;
  const pinned = String(env?.STARCI_CLAUDE_SUPERVISOR_PROJECT ?? '').trim();
  const workspace = String(env?.STARCI_CLAUDE_SUPERVISOR_WORKSPACE ?? '').trim();
  const slug = pinned || (workspace ? claudeProjectSlug(workspace) : '');
  if (slug) dir = dirs.find((d) => samePath(d.slug, slug)) ?? null;
  else {
    let best = -Infinity;
    for (const d of dirs) {
      if (!d.slug.includes('scratch-workspaces')) continue;
      const newest = d.files.reduce((m, f) => Math.max(m, f.stat.mtimeMs), -Infinity);
      if (newest > best) { best = newest; dir = d; }
    }
  }
  if (!dir) return null;
  const newest = dir.files.reduce((m, f) => (f.stat.mtimeMs > (m?.stat.mtimeMs ?? -Infinity) ? f : m), null);
  return newest?.path ?? null;
}

/**
 * Move `from` to `to`, across volumes when a plain rename refuses (EXDEV): copy the bytes, restore the
 * mtimes so archive retention still reads the session's real age, then unlink the source. An existing
 * archive file at `to` is replaced — it can only be an earlier copy of the same transcript.
 */
function moveFile(from, to, stat) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  try { if (fs.existsSync(to)) fs.rmSync(to, { force: true }); } catch { /* rename decides */ }
  try { fs.renameSync(from, to); return; } catch (error) {
    if (error?.code !== 'EXDEV') throw error;
    fs.copyFileSync(from, to);
    try { fs.utimesSync(to, stat.atime, stat.mtime); } catch { /* times are advisory */ }
    fs.unlinkSync(from);
  }
}

/**
 * Archive aged Claude Code transcripts. `apply` performs the moves; without it the same report is a
 * dry-run projection (moved/movedBytes name what WOULD move). Returns
 * {ok, apply, freedBytes, movedBytes, deleted, moved: [{from,to}], skipped: [{path,reason}], errors: [{path,error}]}.
 */
export async function sweepClaudeTranscripts({ apply = false, now = Date.now(), env = process.env, allocation } = {}) {
  const hk = housekeepingOf(allocation);
  const archiveAfterMs = positiveMs(hk.claudeTranscriptArchiveAfterMs) ?? DEFAULT_ARCHIVE_AFTER_MS;
  const recentMs = positiveMs(hk.claudeTranscriptRecentMs) ?? DEFAULT_RECENT_MS;
  const archiveRoot = path.resolve(String(env?.STARCI_ARCHIVE_ROOT || hk.archiveRoot || DEFAULT_ARCHIVE_ROOT));
  const out = { ok: true, apply, freedBytes: 0, movedBytes: 0, deleted: 0, moved: [], skipped: [], errors: [] };

  const dirs = projectDirs(claudeProjectsRoots(env), out);
  const exempt = supervisorSessionFile(dirs, env, now);
  const keep = (file, stat) => {
    if (exempt && samePath(file, exempt)) return 'supervisor-session';
    if (now - stat.mtimeMs < recentMs) return 'recent';
    if (now - stat.mtimeMs <= archiveAfterMs) return 'young';
    return null;
  };
  for (const { slug, files } of dirs) {
    for (const { name, path: file, stat } of files) {
      if (isLinkLike(file, { stat })) { out.skipped.push({ path: file, reason: 'link' }); continue; }
      if (!stat.isFile()) continue;
      const reason = keep(file, stat);
      if (reason) { out.skipped.push({ path: file, reason }); continue; }
      const to = path.join(archiveRoot, 'claude', slug, name);
      if (apply) {
        try { moveFile(file, to, stat); } catch (error) { out.errors.push({ path: file, error: String(error?.message ?? error) }); continue; }
      }
      out.moved.push({ from: file, to });
      out.movedBytes += stat.size;
      out.freedBytes += stat.size;
    }
  }
  out.ok = out.errors.length === 0;
  return out;
}
