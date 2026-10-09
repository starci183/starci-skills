// on-revision.mjs - runs a replay spec against the runtime tree of an OLDER revision: the proof that a replay fails where the bug lived.
//
//   node tests/_replay/on-revision.mjs <sha> <tests/replay/x.spec.mjs> [more specs]
//
// The revision is exported with `git archive` (no worktree, no checkout of this clone) into a disposable directory inside this clone, so that bare imports
// resolve to this clone's node_modules; the harness (tests/_replay), the replay specs and the reduced fixtures of the CURRENT tree are copied over it, and the
// spec runs there with the four standard preloads. The old tree's own scripts, engine and modules are then the code under test. Exit code: the spec's.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const OVERLAY = ['tests/_replay', 'tests/replay', 'tests/fixtures/replay'];
const PRELOADS = ['low-priority', 'isolated-temp', 'isolated-registry', 'runtime-copies'].flatMap((name) => ['--import', `./tests/setup/${name}.mjs`]);

/** Exports `sha` of this repository into `dir` (git archive piped into tar). */
function exportRevision(sha, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const archive = spawnSync('git', ['-C', ROOT, 'archive', '--format=tar', sha], { maxBuffer: 1 << 30 });
  if (archive.status !== 0) throw new Error(`git archive ${sha}: ${archive.stderr}`);
  const untar = spawnSync('tar', ['-x'], { cwd: dir, input: archive.stdout, maxBuffer: 1 << 26 });
  if (untar.status !== 0) throw new Error(`tar: ${untar.stderr}`);
}

/** Runs `specs` against revision `sha`; answers the exit status. */
export function runOnRevision(sha, specs) {
  const dir = path.join(ROOT, `.starci-wk-spec-replay-${sha.slice(0, 9)}`);
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
  try {
    exportRevision(sha, dir);
    for (const rel of OVERLAY) fs.cpSync(path.join(ROOT, rel), path.join(dir, rel), { recursive: true });
    const run = spawnSync(process.execPath, [...PRELOADS, '--test', ...specs], { cwd: dir, stdio: 'inherit', env: { ...process.env, STARCI_RUNTIME: dir } });
    return run.status ?? 1;
  } finally { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const [sha, ...specs] = process.argv.slice(2);
  if (!sha || !specs.length) { console.error('use: on-revision.mjs <sha> <spec> [spec...]'); process.exit(2); }
  process.exitCode = runOnRevision(sha, specs);
}
