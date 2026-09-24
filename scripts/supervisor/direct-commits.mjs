#!/usr/bin/env node
// direct-commits.mjs — the exclusive-mode finding of the land gate (modules/supervisor/supervise.yaml
// landGate.transition). Once config.yaml supervisor.landGate.mode is exclusive, every runtime change
// reaches .claude main through land.mjs only, so a first-parent commit on main that no gate land
// produced is a finding. land.mjs records each land as a `land-passed` event whose payload.landed is
// the sha it moved main to; the newest such sha still an ancestor of main is the boundary, and every
// first-parent commit after it that no land-passed event produced is a direct commit. tick.mjs prints
// each as `DIRECT-COMMIT <sha> <subject>` (silent in shared mode). Read-only: the Supervisor reverts
// and re-lands through the gate — nothing here touches the tree.
//
//   node scripts/supervisor/direct-commits.mjs [--json] [--repo <path>]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { git } from './workers.mjs';
import { SKILL_ROOT, SUPERVISOR_WF, withSupervisorRead } from './home.mjs';

const selfFile = fileURLToPath(import.meta.url);

/** Every sha a `land-passed` event moved main to, oldest first. */
export function gateLandedShas(db, { workflowId = SUPERVISOR_WF } = {}) {
  return db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='land-passed' ORDER BY seq").all(workflowId)
    .map((e) => { try { return JSON.parse(e.payload_json)?.landed; } catch { return null; } })
    .filter((s) => typeof s === 'string' && s.trim());
}

const onMain = (sha, root) => git(['merge-base', '--is-ancestor', sha, 'main'], { cwd: root }).ok;

/**
 * The direct commits of `root`: first-parent commits on main after the newest gate-landed sha still on
 * main that no land-passed event produced, oldest first — [{sha, subject}]. [] when the gate has never
 * landed (there is no boundary to compare against) or `root` has no main. `db` reads an already-open
 * supervisor ledger; otherwise `env` locates it (STARCI_SUPERVISOR_HOME).
 */
export function directCommits({ root = SKILL_ROOT, env = process.env, db = null } = {}) {
  const landed = db ? gateLandedShas(db) : withSupervisorRead((d) => gateLandedShas(d), [], { env });
  if (!landed.length || !git(['rev-parse', '--verify', '--quiet', 'refs/heads/main'], { cwd: root }).ok) return [];
  let boundary = null;
  for (let i = landed.length - 1; i >= 0; i -= 1) if (onMain(landed[i], root)) { boundary = landed[i]; break; }
  if (!boundary) return [];
  const produced = new Set(landed);
  return git(['log', '--first-parent', '--reverse', '--format=%H%x00%s', `${boundary}..main`], { cwd: root }).stdout
    .split(/\r?\n/).filter(Boolean)
    .map((line) => { const sep = line.indexOf('\0'); return { sha: line.slice(0, sep), subject: line.slice(sep + 1) }; })
    .filter((c) => c.sha && !produced.has(c.sha));
}

export const describeDirect = (c) => `DIRECT-COMMIT ${c.sha} ${c.subject}`;

if (process.argv[1] && path.resolve(process.argv[1]) === selfFile) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--repo');
  const commits = directCommits({ root: i >= 0 && argv[i + 1] ? path.resolve(argv[i + 1]) : SKILL_ROOT });
  console.log(argv.includes('--json') ? JSON.stringify(commits) : commits.map(describeDirect).join('\n'));
  if (commits.length) process.exitCode = 1;
}
