// terminal-dedupe.mjs — close the StarCi terminals Orca restored that no ledger owns.
//
// After the 2026-09-24 reboot Orca 1.4.209 restored its previous tabs: four
// old nivo Claude kernel sessions with their conversation history (idle
// prompts, one still showing the old AUTH kernel's last message) and six bare
// PowerShell tabs (old qwen op tabs). The watchdogs found the ledger's kernel
// terminals gone and started eight new kernels, so every workflow had two
// kernel sessions, and a restored one would have acted as a duplicate kernel
// the moment anything woke it. The supervisor closed ten terminals by hand.
//
// A terminal is closed only when ALL of these hold:
//   - it sits in a worktree of one of the resumed repos (the repo or one of
//     its `git worktree list` paths);
//   - no ledger binds it: not a kernel signal terminal, not the worker_id of a
//     running kernel job, not the worker of a running/answering job;
//   - it is not the caller's own terminal (ORCA_TERMINAL_HANDLE);
//   - its repo has no launch in flight (a kernel signal still 'starting' or a
//     leased job: a terminal being created is unbound for a moment);
//   - and it is either a bare shell prompt (the agent exited:
//     terminal-liveness.mjs exitedAgentPromptRow) or an agent session carrying
//     a StarCi marker: a [Kernel]/[Op] tab or pane title, "kernel" in its
//     title, an op-<kind>-<hex> job id or a qwen-code title or frame.
// An agent session with no StarCi marker is the owner's own and is never
// touched; an unreadable frame is left alone. An agent session gets its CLI's
// own quit first (quit-agent.mjs: Claude a double Ctrl+C), then the tab close.
import fs from 'node:fs';
import path from 'node:path';
import { terminalList } from '../api/orca/terminal-list.mjs';
import { parseJsonOr } from '../lib/json.mjs';
import { gitSpawn } from '../lib/git.mjs';
import { terminalRead } from '../api/orca/terminal-read.mjs';
import { exitedAgentPromptRow } from './terminal-liveness.mjs';
import { quitAgent, agentOfTerminal } from './quit-agent.mjs';
import { closeOperationTerminal } from './close-op-terminal.mjs';
import { withLedgerRead } from '../connectors/lib.mjs';

// A StarCi title or frame: [Kernel]/[Op] names, an operation job id
// (op-backend.implement-ed43628b07), a qwen-code session.
export const STARCI_MARKER = /\[(?:Kernel|Op)\]|\bop-[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+-[0-9a-f]{6,}\b|\bqwen(?:[- ]?code)?\b/i;
// "kernel" counts in a title only: a Claude kernel's pane title reads
// "✳ Nivo app auth kernel workflow"; a frame may mention the word anywhere.
const KERNEL_TITLE = /\bkernel\b/i;
const HOLDS_A_WORKER = ['running', 'answering'];

const norm = (p) => String(p ?? '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
const under = (p, root) => { const a = norm(p), b = norm(root); return Boolean(a && b) && (a === b || a.startsWith(`${b}/`)); };

/** handle -> tab title, from a `terminal list --include-visual-layouts` visualLayouts array. */
export function tabTitlesOf(visualLayouts, terminals = []) {
  const byTab = new Map();
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (typeof node.tabId === 'string' && 'panes' in node && typeof node.title === 'string') byTab.set(node.tabId, node.title);
    for (const value of Object.values(node)) if (value && typeof value === 'object') walk(value);
  };
  walk(visualLayouts);
  return new Map(terminals.filter((t) => t?.handle).map((t) => [t.handle, byTab.get(t.tabId) ?? null]));
}

/**
 * One unbound terminal's verdict: {action:'close'|'keep', kind, reason, marker?}.
 * `titles` are the tab and pane titles; `screen` the frame (null when unreadable).
 */
export function classifyStrayTerminal({ titles = [], screen }) {
  if (screen == null) return { action: 'keep', kind: null, reason: 'unreadable' };
  const shellPrompt = exitedAgentPromptRow(screen);
  if (shellPrompt) return { action: 'close', kind: 'shell', reason: 'bare-shell', shellPrompt };
  const titleText = titles.filter(Boolean).join(' | ');
  const marker = STARCI_MARKER.exec(titleText)?.[0] ?? (KERNEL_TITLE.test(titleText) ? 'kernel' : null)
    ?? STARCI_MARKER.exec(String(screen).split(/\r?\n/).slice(-60).join('\n'))?.[0] ?? null;
  if (marker) return { action: 'close', kind: 'agent', reason: 'starci-agent-session', marker };
  return { action: 'keep', kind: 'agent', reason: 'no-starci-marker' };
}

/** The handles a ledger binds, and whether a launch is in flight there. Read-only. */
export function ledgerBindings(repo, { now = Date.now() } = {}) {
  return withLedgerRead(repo, (db) => {
    const bound = new Set();
    let busy = null;
    for (const s of db.prepare("SELECT key,value_json,expires_at FROM signals WHERE scope='kernel'").all()) {
      const value = parseJsonOr(s.value_json);
      if (value.terminal) bound.add(value.terminal);
      if (!value.terminal && (s.expires_at == null || s.expires_at > now)) busy = busy ?? `kernel of ${s.key} is starting`;
    }
    for (const j of db.prepare('SELECT job_id,kind,status,worker_id,payload_json FROM jobs').all()) {
      if (j.status === 'leased') busy = busy ?? `job ${j.job_id} is being dispatched`;
      if (!(HOLDS_A_WORKER.includes(j.status))) continue;
      const p = parseJsonOr(j.payload_json);
      for (const h of [j.worker_id, p?.orca?.agentTerminalHandle, p?.managed?.agentTerminalHandle, p?.hierarchy?.runtime?.terminalHandle]) if (h) bound.add(h);
    }
    return { bound, busy };
  }, { bound: new Set(), busy: 'ledger unreadable' });
}

/** The repo and its linked worktrees (`git worktree list --porcelain`), best effort. */
export function worktreesOf(repo, { run = gitSpawn } = {}) {
  const paths = new Set([path.resolve(repo)]);
  try {
    const r = run('git', ['-C', repo, 'worktree', 'list', '--porcelain'], { timeout: 20_000 });
    if (r.status === 0) for (const line of String(r.stdout ?? '').split(/\r?\n/)) if (line.startsWith('worktree ')) paths.add(path.resolve(line.slice(9).trim()));
  } catch { /* the repo alone */ }
  return [...paths];
}

/**
 * The dedupe plan over one listing. `scopes`: [{repo, worktrees, bound:Set, busy}].
 * Returns {close:[entry], keep:[entry], deferred:[entry]}; each entry names
 * {handle, repo, tabTitle, paneTitle, agent, kind?, reason, marker?}.
 */
export function planTerminalDedupe({ terminals = [], tabTitles = new Map(), scopes = [], protectedHandles = new Set(), readScreen }) {
  const plan = { close: [], keep: [], deferred: [] };
  const boundAnywhere = new Set(scopes.flatMap((s) => [...(s.bound ?? [])]));
  for (const t of terminals) {
    if (!t?.handle || t.connected === false) continue;
    const scope = scopes.find((s) => (s.worktrees ?? [s.repo]).some((w) => under(t.worktreePath ?? t.cwd, w)));
    if (!scope) continue;
    const entry = { handle: t.handle, repo: scope.repo, tabTitle: tabTitles.get(t.handle) ?? null, paneTitle: t.title ?? null, agent: t.agentIdentity ?? null };
    if (boundAnywhere.has(t.handle)) continue;
    if (protectedHandles.has(t.handle)) { plan.keep.push({ ...entry, reason: 'caller-terminal' }); continue; }
    if (scope.busy) { plan.deferred.push({ ...entry, reason: scope.busy }); continue; }
    let screen = null;
    try { screen = readScreen(t.handle); } catch { screen = null; }
    const verdict = classifyStrayTerminal({ titles: [entry.tabTitle, entry.paneTitle], screen });
    (verdict.action === 'close' ? plan.close : plan.keep).push({ ...entry, ...verdict });
  }
  return plan;
}

/**
 * List Orca's terminals, plan, and (unless dryRun) close every stray: an agent
 * session gets its quit input first, then the tab close. Never throws.
 * Returns {ok, dryRun, listed, closed:[...], kept:[...], deferred:[...], skipped?, error?}.
 */
export function dedupeTerminals({ repos = [], dryRun = false, env = process.env, deps = {} } = {}) {
  const list = deps.list ?? (() => terminalList({ includeVisualLayouts: true }));
  const read = deps.read ?? ((handle) => { const r = terminalRead({ terminal: handle, screen: true }); return r?.ok ? String(r.screen ?? '') : null; });
  const quit = deps.quit ?? quitAgent;
  const close = deps.close ?? ((handle) => closeOperationTerminal(handle));
  const bindings = deps.bindings ?? ledgerBindings;
  const worktrees = deps.worktrees ?? worktreesOf;
  const result = { ok: true, dryRun, listed: 0, closed: [], kept: [], deferred: [] };
  try {
    const listed = list();
    if (!listed?.ok) return { ...result, ok: false, skipped: listed?.hostUnavailable ? 'orca-unavailable' : 'terminal-list-failed', error: listed?.error ?? null };
    const terminals = listed.terminals ?? [];
    result.listed = terminals.length;
    const scopes = repos.filter((repo) => fs.existsSync(repo)).map((repo) => ({ repo, worktrees: worktrees(repo), ...bindings(repo) }));
    const plan = planTerminalDedupe({ terminals, tabTitles: tabTitlesOf(listed.visualLayouts ?? [], terminals), scopes,
      protectedHandles: new Set([env.ORCA_TERMINAL_HANDLE].filter(Boolean)), readScreen: read });
    result.kept = plan.keep;
    result.deferred = plan.deferred;
    for (const entry of plan.close) {
      if (dryRun) { result.closed.push({ ...entry, wouldClose: true }); continue; }
      let quitResult = null;
      if (entry.kind === 'agent') { try { quitResult = quit({ handle: entry.handle, agent: agentOfTerminal(entry) }); } catch (error) { quitResult = { error: String(error?.message ?? error) }; } }
      let closed;
      try { closed = close(entry.handle); } catch (error) { closed = { ok: false, error: String(error?.message ?? error) }; }
      // An agent that quit on its own may have taken its terminal with it: a refused close of a gone terminal is still closed.
      const ok = closed?.ok === true || quitResult?.exited === true;
      if (!ok) result.ok = false;
      result.closed.push({ ...entry, ok, ...(quitResult ? { quit: quitResult } : {}), ...(closed?.tab ? { tab: closed.tab } : {}),
        ...(closed?.ok ? {} : { error: String(closed?.error ?? 'close refused') }) });
    }
  } catch (error) {
    return { ...result, ok: false, error: String(error?.message ?? error) };
  }
  return result;
}

export const describeDedupe = (d) => !d ? [] : [
  `  dedupe    ${d.skipped ? `skipped (${d.skipped})` : `${d.closed.length} stray terminal(s) ${d.dryRun ? 'would close' : 'closed'}, ${d.kept.length} kept, ${d.deferred.length} deferred`}`,
  ...d.closed.map((c) => `    ${c.wouldClose ? 'would close' : c.ok ? 'closed' : 'FAILED'} ${c.handle} (${c.kind}: ${c.marker ?? c.reason}; ${c.tabTitle ?? c.paneTitle ?? 'untitled'})${c.error ? ` ${c.error}` : ''}`),
  ...d.deferred.map((c) => `    deferred ${c.handle}: ${c.reason}`),
];
