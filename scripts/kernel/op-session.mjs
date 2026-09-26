// op-session.mjs — per-op agent-session identity and release at settle.
//
// Host housekeeping ("per-op session release at settle", STORAGE-PROMPT item
// 8): when `api settle` closes an op, that op's own agent session files move
// to the session archive root right away instead of piling up under
// ~/.claude/projects, the Codex session homes and ~/.qwen.
//
// The dispatch record already identifies the agent — payload
// provider/agent/model, the orca/managed agentTerminalHandle, the contract's
// worktree and the op-dispatched event time — so the session file itself is
// what this module recovers: under the agent's own session home, created
// inside the job's dispatch window, and ATTRIBUTED by content to the job (the
// worker's prompt names its durable job id on the first line). Attribution is
// the safety bound: the live kernel's own session, a sibling op's session in
// the same project dir and the owner's own sessions never contain this job's
// id and are never moved — a skipped release just leaves the file for the
// age-based housekeeping sweep.
//
// Hard rules honoured here:
//   - the live kernel's own session is never touched: kernel-kind jobs are
//     never released, and a kernel session file never carries an op's job id;
//   - a session whose terminal is still open is never moved: the same
//     terminal liveness settle/dedupe read (terminal-show) gates the archive;
//   - settle never fails on the release: every early exit is a recorded
//     {released:false, reason} and the archiver itself is optional
//     (scripts/lib/hk-sessions.mjs, loaded lazily).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseJson } from '../lib/json.mjs';
import { orcaCodexHome } from '../agent/trust.mjs';
import { terminalShow, TERMINAL_GONE_CODES } from '../api/orca/terminal-show.mjs';

// A worker's session file exists before the op-dispatched event lands (the
// terminal launch precedes prompt send and attestation), so the identity
// window opens this far before the event.
export const SESSION_LEAD_MS = 30 * 60 * 1000;
// Only the head of a session file is scanned for the job id: the dispatch
// preamble is the worker's first user message.
const SESSION_GREP_BYTES = 256 * 1024;
// allocation.housekeeping.archiveRoot's declared default (runtimes.yaml).
export const DEFAULT_SESSION_ARCHIVE_ROOT = 'D:/starci-archive';

// The agent provider of a job payload — the same read api.mjs agentOfJob
// makes, kept local so the module is usable without the api's bindings.
export const sessionAgentOf = (payload) =>
  /^(claude|codex|devin|qwen)/i.exec(String(payload?.provider ?? payload?.agent ?? payload?.model ?? payload?.route?.agent ?? ''))?.[1]?.toLowerCase()
  ?? (payload?.managed ? 'claude' : null);

/** The project-dir slug an agent CLI derives from a cwd: every non-alphanumeric becomes '-'; Qwen lowercases it. */
export const sessionProjectSlug = (cwd, { lower = false } = {}) => {
  const slug = String(path.resolve(cwd)).replace(/[^A-Za-z0-9]/g, '-');
  return lower ? slug.toLowerCase() : slug;
};

/**
 * The session homes the runtime already knows, re-rooted the way
 * scripts/agent/trust.mjs trustTargets re-roots them for specs
 * (STARCI_AGENT_TRUST_HOME): claude <home>/.claude (or CLAUDE_CONFIG_DIR),
 * codex CODEX_HOME + <home>/.codex + Orca's codex-runtime-home, qwen
 * <home>/.qwen. Under NODE_TEST_CONTEXT without the re-root the lookup is
 * refused — a spec process never scans the owner's real sessions.
 */
export function sessionHomes({ env = process.env, platform = process.platform, home = os.homedir() } = {}) {
  const root = env.STARCI_AGENT_TRUST_HOME || null;
  if (!root && env.NODE_TEST_CONTEXT) return { skipped: 'test-env-unrooted' };
  const h = root || home;
  const codexHomes = [];
  const add = (dir) => { if (dir && !codexHomes.some((d) => path.resolve(d).toLowerCase() === path.resolve(dir).toLowerCase())) codexHomes.push(path.resolve(dir)); };
  if (!root) add(env.CODEX_HOME);
  add(path.join(h, '.codex'));
  add(root
    ? orcaCodexHome({ env: { APPDATA: path.join(root, 'AppData', 'Roaming'), XDG_CONFIG_HOME: path.join(root, '.config') }, platform, home: root })
    : orcaCodexHome({ env, platform, home }));
  return {
    claude: !root && env.CLAUDE_CONFIG_DIR ? path.resolve(env.CLAUDE_CONFIG_DIR) : path.join(h, '.claude'),
    codex: codexHomes,
    qwen: path.join(h, '.qwen'),
  };
}

/** Directories an agent's session files for `cwd` live under (claude and qwen key sessions by project dir). */
export function sessionDirsFor(agent, cwd, homes) {
  if (agent === 'claude') return [{ dir: path.join(homes.claude, 'projects', sessionProjectSlug(cwd)), match: (f) => f.endsWith('.jsonl') }];
  if (agent === 'qwen') {
    const slug = sessionProjectSlug(cwd, { lower: true });
    return ['projects', 'tmp'].map((base) => ({ dir: path.join(homes.qwen, base, slug, 'chats'), match: (f) => f.endsWith('.jsonl') }));
  }
  return [];
}

const createdMs = (stat) => (stat.birthtimeMs > 0 ? stat.birthtimeMs : stat.mtimeMs);

/** True when the file's head (the worker's first message) names `needle`. */
const mentions = (file, needle) => {
  try {
    const fd = fs.openSync(file, 'r');
    try {
      const buf = Buffer.alloc(SESSION_GREP_BYTES);
      const n = fs.readSync(fd, buf, 0, SESSION_GREP_BYTES, 0);
      return buf.subarray(0, n).includes(String(needle));
    } finally { fs.closeSync(fd); }
  } catch { return false; }
};

const candidatesIn = (dir, match, { sinceMs, untilMs }) => {
  let names = [];
  try { names = fs.readdirSync(dir); } catch { return []; }
  const out = [];
  for (const name of names) {
    if (!match(name)) continue;
    const file = path.join(dir, name);
    let stat = null;
    try { stat = fs.statSync(file); } catch { continue; }
    if (!stat.isFile()) continue;
    const created = createdMs(stat);
    // Outside the job's dispatch window it cannot be this job's session.
    if (created < sinceMs) continue;
    if (untilMs != null && created > untilMs) continue;
    out.push({ file, createdMs: created });
  }
  return out;
};

// Codex keys sessions by date, not by project: <home>/sessions/<YYYY>/<MM>/<DD>/rollout-*.jsonl
// under every Codex home the runtime knows (CODEX_HOME, ~/.codex, Orca's codex-runtime-home).
const codexSessionCandidates = (homes, window) => {
  const out = [];
  for (const home of homes.codex) {
    const root = path.join(home, 'sessions');
    let years = [];
    try { years = fs.readdirSync(root); } catch { continue; }
    for (const year of years.filter((d) => /^\d{4}$/.test(d))) {
      let months = [];
      try { months = fs.readdirSync(path.join(root, year)); } catch { continue; }
      for (const month of months.filter((d) => /^\d{2}$/.test(d))) {
        let days = [];
        try { days = fs.readdirSync(path.join(root, year, month)); } catch { continue; }
        for (const day of days.filter((d) => /^\d{2}$/.test(d)))
          out.push(...candidatesIn(path.join(root, year, month, day), (f) => f.endsWith('.jsonl'), window));
      }
    }
  }
  return out;
};

/**
 * The session files a job's agent may own: created inside the dispatch
 * window, each flagged `matched` when its head names the job id — the
 * attribution settle archives on and every other session fails.
 */
export function sessionCandidates({ agent, cwds = [], sinceMs, untilMs = null, homes, jobId }) {
  if (!agent || !homes || homes.skipped || sinceMs == null) return [];
  let found = agent === 'codex'
    ? codexSessionCandidates(homes, { sinceMs, untilMs })
    : cwds.flatMap((cwd) => sessionDirsFor(agent, cwd, homes)).flatMap(({ dir, match }) => candidatesIn(dir, match, { sinceMs, untilMs }));
  const seen = new Set();
  found = found.filter((c) => {
    const key = path.resolve(c.file).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  for (const c of found) c.matched = jobId ? mentions(c.file, jobId) : false;
  return found;
}

/** The op's dispatch-bound worktree plus the ledger repo: the cwds its session can be filed under. */
const sessionCwdsOf = (db, job, repo) => {
  const cwds = [];
  try {
    const op = job.op_id ?? parseJson(job.payload_json)?.opId ?? null;
    const context = parseJson(db.prepare('SELECT context_json FROM contracts WHERE workflow_id=? AND op_id=? AND attempt=?')
      .get(job.workflow_id, op, job.attempt)?.context_json);
    if (typeof context?.worktree === 'string') cwds.push(path.resolve(repo, context.worktree));
  } catch { /* contract context is optional */ }
  cwds.push(path.resolve(repo));
  return [...new Set(cwds)];
};

/**
 * The job's session identity as the runtime can learn it: {agent, cwds,
 * dispatchedAt, files:[{file, matched}], resolvedAt} — or a `reason` when the
 * agent/home does not resolve (devin keeps everything in sessions.db, which
 * housekeeping handles when no devin.exe runs; it is never moved here).
 */
export function sessionIdentityOf(db, job, payload, repo, { env = process.env, home = os.homedir(), now = Date.now() } = {}) {
  const agent = sessionAgentOf(payload);
  const identity = { agent, resolvedAt: now };
  if (!agent) return { ...identity, reason: 'agent-unknown' };
  if (agent === 'devin') return { ...identity, reason: 'sessions-db-owned' };
  const homes = sessionHomes({ env, home });
  if (homes.skipped) return { ...identity, reason: homes.skipped };
  const cwds = sessionCwdsOf(db, job, repo);
  const dispatchedAt = db.prepare("SELECT MAX(created_at) at FROM events WHERE entity_id=? AND kind='op-dispatched'").get(job.job_id)?.at ?? null;
  const sinceMs = (dispatchedAt ?? job.updated_at ?? now) - SESSION_LEAD_MS;
  const files = sessionCandidates({ agent, cwds, sinceMs, homes, jobId: job.job_id });
  return { ...identity, cwds, dispatchedAt, files: files.map((f) => ({ file: f.file, matched: f.matched === true })) };
}

/** The hk-sessions archiver, lazy: its lane lands it; an absent module skips, never fails. */
const sessionArchiver = async (env) => {
  try {
    const mod = await import(env.STARCI_HK_SESSIONS_MODULE ?? new URL('../lib/hk-sessions.mjs', import.meta.url).href);
    return typeof mod.archiveSessionFiles === 'function' ? mod.archiveSessionFiles : null;
  } catch { return null; }
};

/**
 * Release the settled job's own session files to the archive root.
 * {released:true, files, archiveRoot} or {released:false, reason, files?} —
 * never throws, never touches the kernel's or another session's files:
 *   - job is not an op (a kernel job's own session is never archived);
 *   - the worker's terminal still reads connected (or cannot be read at all);
 *   - no file inside the dispatch window names the job id.
 * `show`/`archive` are the spec seams; `archive` defaults to
 * scripts/lib/hk-sessions.mjs archiveSessionFiles(paths, {archiveRoot, agent, apply:true}).
 */
export async function releaseSettledSession({ db, job, payload, repo, env = process.env, home = os.homedir(), archiveRoot = null, show = terminalShow, archive = null, now = Date.now() } = {}) {
  const agent = sessionAgentOf(payload);
  if (job.kind !== 'op') return { released: false, agent, reason: 'not-an-op-job' };
  if (!agent) return { released: false, agent, reason: 'agent-unknown' };
  if (agent === 'devin') return { released: false, agent, reason: 'sessions-db-owned' };
  if (sessionHomes({ env, home }).skipped) return { released: false, agent, reason: 'test-env-unrooted' };
  // A session whose terminal is still open is never moved — the same
  // terminal-handle liveness the settle/dedupe code reads gates the archive.
  const handle = payload?.managed?.agentTerminalHandle ?? payload?.orca?.agentTerminalHandle ?? job.worker_id ?? payload?.launchTerminal?.handle ?? null;
  const skip = (reason, extra = {}) => ({ released: false, agent, reason, handle, ...extra });
  if (handle && env.ORCA_TERMINAL_HANDLE === handle) return skip('caller-terminal');
  if (handle) {
    let shown = null;
    try { shown = show({ terminal: handle }); } catch { shown = null; }
    if (shown?.ok && shown.connected === true) return skip('terminal-still-open');
    const gone = shown?.ok === true || (shown?.hostUnavailable !== true && TERMINAL_GONE_CODES.has(shown?.errorCode));
    if (!gone) return skip(shown?.hostUnavailable ? 'orca-unavailable' : 'terminal-unreadable');
  }
  const identity = sessionIdentityOf(db, job, payload, repo, { env, home, now });
  const attributed = new Set(identity.files.filter((f) => f.matched).map((f) => f.file));
  // The identity observe already learned stands too (session files are stable once created).
  for (const f of Array.isArray(payload?.session?.files) ? payload.session.files : [])
    if (f?.matched && typeof f.file === 'string') { try { if (fs.existsSync(f.file)) attributed.add(f.file); } catch { /* gone */ } }
  // A qwen chat's sidecar travels with its session file.
  for (const file of [...attributed]) {
    const sidecar = file.replace(/\.jsonl$/i, '.runtime.json');
    if (agent === 'qwen' && sidecar !== file && !attributed.has(sidecar) && fs.existsSync(sidecar)) attributed.add(sidecar);
  }
  const files = [...attributed];
  if (!files.length) return skip(identity.files.length ? 'unattributed-session' : 'no-session-file', { cwds: identity.cwds, candidates: identity.files.length });
  const root = env.STARCI_SESSION_ARCHIVE_ROOT ?? archiveRoot ?? DEFAULT_SESSION_ARCHIVE_ROOT;
  const run = archive ?? await sessionArchiver(env);
  if (!run) return skip('archiver-unavailable', { files, archiveRoot: root });
  try {
    const result = run(files, { archiveRoot: root, agent, apply: true });
    return { released: true, agent, cwds: identity.cwds, files, archiveRoot: root, archived: result ?? null };
  } catch (error) {
    return skip(String(error?.message ?? error), { files, archiveRoot: root });
  }
}
