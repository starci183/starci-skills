#!/usr/bin/env node
// seat-tools.mjs — the Claude Code PreToolUse hook that enforces a seat's denied tools (.claude/settings.json).
// worker-start takes no provider argv, so a seat launched through it cannot carry --disallowedTools: the runtime binds
// the seat's terminal instead (scripts/guards/hook-install.mjs bindSeatGuard -> <guards root>/seats/<handle>.json) and this
// hook denies exactly those tools for exactly that terminal (ORCA_TERMINAL_HANDLE, which Orca exports into it).
// Every other session - no Orca handle, or a handle with no seat guard - passes untouched.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { guardsRoot } from './guards-root.mjs';
import { isMain } from '../lib/is-main.mjs';
import { readEnv } from '../lib/env.mjs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const safeName = (s) => String(s).replace(/[^A-Za-z0-9._-]/g, '_');

/** The deny decision for one hook input, or null to pass: {reason} when `toolName` is denied for `handle`. */
export function seatToolDecision({ handle, toolName, root = skillRoot }) {
  if (!handle || !toolName) return null;
  let guard;
  try { guard = JSON.parse(fs.readFileSync(path.join(guardsRoot(root), 'seats', `${safeName(handle)}.json`), 'utf8')); }
  catch { return null; }
  if (!Array.isArray(guard?.deniedTools) || !guard.deniedTools.includes(toolName)) return null;
  return { reason: `${toolName} is denied for the ${guard.role ?? 'seat'} (${handle}): in-process subagents bypass [Worker] jobs, leases and the land gate - queue a [Worker] job instead (modules/supervisor/supervisor-prompt.md).` };
}

if (isMain(import.meta.url)) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => {
    let toolName = null;
    try { toolName = JSON.parse(input)?.tool_name ?? null; } catch { /* no decision on unreadable input */ }
    const decision = seatToolDecision({ handle: readEnv('ORCA_TERMINAL_HANDLE'), toolName });
    if (decision) console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: decision.reason } }));
  });
}
