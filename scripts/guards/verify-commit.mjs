#!/usr/bin/env node
// verify-commit.mjs — the history hook's op half (scripts/guards/install.mjs historyHookBody):
//
//   STARCI_GUARD_FILE=<guard> node verify-commit.mjs <old> <new>
//
// The commits a protected-branch update brings carry only the op's owned paths. The hook names the op's guard (the
// file bound to its Orca terminal, runtime/guards/terminals/<handle>.json) in STARCI_GUARD_FILE for this one call.
// Fail-open on the check's OWN faults: a bug here must never block a commit, so an internal error lets it land.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitSpawn } from '../lib/git.mjs';
import { pathKey } from '../lib/path-key.mjs';
import { readJsonFile } from '../lib/json.mjs';
import { refusalLines, logRefusal } from './refusals.mjs';

const say = (line) => process.stderr.write(`${line}\n`);

function gitTop(git, cwd) {
  const r = gitSpawn(git, ['rev-parse', '--show-toplevel'], { cwd });
  return r.status === 0 && r.stdout.trim() ? path.resolve(r.stdout.trim()) : null;
}

// The commits a protected-branch update brings that no remote-tracking ref already holds carry only the job's owned
// paths. A merge counts with the files it differs from every parent in, and each commit it brings from its other side
// is a commit of its own; a pull or fast-forward of published history brings none. (diff-tree of a merge without -c
// lists nothing, so a merged foreign branch landed unseen.)
export function foreignPathsOf({ git = 'git', cwd, oldSha, newSha, owned }) {
  const run = (args) => gitSpawn(git, args, { cwd });
  const top = gitTop(git, cwd);
  const brought = run(['rev-list', newSha, '--not', oldSha, '--remotes']);
  if (brought.status !== 0 || !top) return { checked: false, foreign: [] };
  const roots = owned.map(pathKey);
  const foreign = new Set();
  for (const sha of brought.stdout.split(/\r?\n/).filter(Boolean)) {
    const listed = run(['diff-tree', '-r', '-c', '--root', '--name-only', '--no-commit-id', '-z', sha]);
    if (listed.status !== 0) return { checked: false, foreign: [] };
    for (const rel of listed.stdout.split('\0').filter(Boolean)) {
      const n = pathKey(path.join(top, rel));
      if (!roots.some((r) => n === r || n.startsWith(`${r}/`))) foreign.add(rel);
    }
  }
  return { checked: true, foreign: [...foreign] };
}

export function verifyCommit(oldSha, newSha, guard, { cwd = process.cwd() } = {}) {
  if (!guard?.owned?.length) return 0;
  let result;
  try { result = foreignPathsOf({ cwd, oldSha, newSha, owned: guard.owned }); }
  catch (e) { say(`starci guard: commit check error (${e?.message ?? e}); letting the commit land`); return 0; }
  if (!result.foreign.length) return 0;
  const verdict = { code: 'COMMIT_FOREIGN_PATHS', command: `commit ${newSha.slice(0, 10)}`,
    reason: `the commit carries paths outside your owned_paths: ${result.foreign.slice(0, 12).join(', ')} (a hook may have re-staged them, or a merge brought them)`,
    remedy: 'unstage them with `git restore --staged -- <those paths>` and commit your owned paths again with `git commit -m "<msg>" -- <owned paths>`; never merge another branch into the shared one' };
  for (const line of refusalLines('git', verdict)) say(line);
  logRefusal({ tool: 'git', via: 'history-hook', ...verdict, jobId: guard.jobId ?? null, workflowId: guard.workflowId ?? null, cwd });
  return 3;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [oldSha, newSha] = process.argv.slice(2);
  const guard = process.env.STARCI_GUARD_FILE ? readJsonFile(process.env.STARCI_GUARD_FILE) : null;
  process.exit(verifyCommit(oldSha, newSha, guard));
}
