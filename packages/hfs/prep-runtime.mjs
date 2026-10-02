// prep-runtime.mjs - runs as the packages' prepack and pretest so their generated runtime/ copy exists before a pack
// or a test reads it. `runtime/` is the git-ignored output of the repository's scripts/hfs/sync-runtime.mjs
// (ruleParams.runtime.generated of knowledge/hfs/runtime-slots.yaml): nothing edits it and it is never committed.
// This file walks up from the package directory to the repository root and runs the generator; where the generator
// cannot exist (a copied package tree, e.g. the clean-package proof's tracked-files-only checkout, which carries the
// freshly synced copy) a populated runtime/ is already there and this is a no-op. Exit 1 when neither holds.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const cwd = process.cwd();
const GENERATOR = path.join('scripts', 'hfs', 'sync-runtime.mjs');
const SENTINEL = path.join('runtime', 'scripts', 'hfs', 'slots.mjs');

for (let dir = cwd; ; dir = path.dirname(dir)) {
  if (fs.existsSync(path.join(dir, GENERATOR))) {
    const r = spawnSync(process.execPath, [GENERATOR], { cwd: dir, stdio: 'inherit' });
    process.exitCode = r.status ?? 1;
    break;
  }
  if (path.dirname(dir) === dir) {
    if (!fs.existsSync(path.join(cwd, SENTINEL))) {
      process.stderr.write(`runtime/ is absent and ${GENERATOR.split(path.sep).join('/')} is not reachable from ${cwd}: run it in the repository first\n`);
      process.exitCode = 1;
    }
    break;
  }
}
