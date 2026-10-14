// The record-path evidence behind a free-text gate. Forbidden lite paths are obsolete waits; workspace.yaml and brand remain readable.
import fs from 'node:fs';
import path from 'node:path';
import { workPathAllowed } from '../lib/work-edition.mjs';
import { clock } from './stall-findings.mjs';
import { WORK_DIR_NAME } from '../lib/roots.mjs';

/** `.starciwork/...` paths an incident names, trailing punctuation dropped. */
export const namedPaths = (text) => [...new Set((String(text ?? '').match(/\.starciwork\/[A-Za-z0-9._@\-/]+/g) ?? [])
  .map((p) => p.replace(new RegExp(['[./-', ']+$'].join('')), '')).filter((p) => p.length > '.starciwork/'.length))];

/** Record states that mean the thing a gate waited for has landed. */
const LANDED_STATES = new Set(['done', 'settled', 'decided', 'approved', 'accepted', 'final', 'complete', 'completed', 'passed', 'ready']);
const landedPathReason = (ev, raisedAt) => {
  const state = ev.state ? ' (' + ev.state + ')' : '';
  let when;
  if (ev.created) {
    when = 'created ' + clock(ev.born);
    if (ev.written - ev.born > 60_000) when += ', written ' + clock(ev.written);
  } else when = 'written ' + clock(ev.written);
  return `${ev.path} exists${state}, ${when} after the gate (${clock(raisedAt)})`;
};

/** A named path that landed after the gate, or one still absent or unsettled. */
function pathEvidence(repo, rel, raisedAt) {
  const none = { path: rel, exists: false, landed: false, waiting: true, at: null, born: null, written: null, created: false, state: null };
  if (!repo) return { ...none, waiting: false };
  let file = path.join(repo, rel);
  let st;
  try { st = fs.statSync(file); } catch { return none; }
  if (st.isDirectory()) {
    const index = path.join(file, 'index.yaml');
    try { st = fs.statSync(index); file = index; } catch { /* a bare directory */ }
  }
  let state = null;
  if (st.isFile() && /\.ya?ml$/i.test(file) && st.size < 2_000_000) {
    try { state = /^(?:state|status):\s*['"]?([A-Za-z0-9_-]+)/m.exec(fs.readFileSync(file, 'utf8'))?.[1] ?? null; } catch { /* unreadable */ }
  }
  const born = Number.isFinite(st.birthtimeMs) && st.birthtimeMs > 0 ? st.birthtimeMs : st.mtimeMs;
  const at = Math.max(born, st.mtimeMs);
  const settledState = !state || LANDED_STATES.has(state.toLowerCase());
  return { path: rel, exists: true, landed: at > raisedAt && settledState, waiting: !settledState, at, born, written: st.mtimeMs, created: born > raisedAt, state };
}

/** What the paths a gate names say: reasons for each that landed, waits for each still absent or unsettled. */
export const pathVerdict = (repo, gate, paths) => {
  const reasons = [], waits = [];
  for (const rel of paths) {
    if (repo) {
      const workRoot = path.join(repo, WORK_DIR_NAME), file = path.join(repo, rel);
      if (!workPathAllowed(workRoot, file) && !workPathAllowed(workRoot, file, { dir: true })) {
        reasons.push(`${rel} cannot be required: lite .starciwork holds only workspace.yaml and brand/ (plus .gitignore)`);
        continue;
      }
    }
    const ev = pathEvidence(repo, rel, gate.raisedAt);
    if (ev.landed) reasons.push(landedPathReason(ev, gate.raisedAt));
    else if (ev.waiting) waits.push(ev.path + ' ' + (ev.exists ? 'is ' + ev.state : 'is absent'));
  }
  return { reasons, waits };
};
