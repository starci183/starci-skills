// test-world-dist.mjs - whether packages/test-world/dist is the build of the package's current source. The dist is untracked build output
// (like packages/grammar/dist): a copy built before a source change types the example apps against an API that no longer exists, so a spec
// that borrows the build refuses a stale one by naming the command that rebuilds it, never builds it itself (several specs run side by side).
import fs from 'node:fs';
import path from 'node:path';

export const TEST_WORLD_BUILD_COMMAND = 'npm run build (in packages/test-world; npm ci --ignore-scripts first when it has no node_modules)';

/** The newest modification time (ms) of any file under `dir`, 0 when it holds none. */
function newestMtime(dir) {
  let newest = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    newest = Math.max(newest, entry.isDirectory() ? newestMtime(full) : fs.statSync(full).mtimeMs);
  }
  return newest;
}

/** Why the build of the test-world package at `producer` cannot be used, or null when its dist is at least as new as its source and manifest. */
export function testWorldDistProblem(producer) {
  const pkg = JSON.parse(fs.readFileSync(path.join(producer, 'package.json'), 'utf8'));
  const types = path.join(producer, pkg.types);
  if (!fs.existsSync(types)) return `the test-world build is absent (${pkg.types}): run ${TEST_WORLD_BUILD_COMMAND}`;
  const source = Math.max(newestMtime(path.join(producer, 'src')), fs.statSync(path.join(producer, 'package.json')).mtimeMs, fs.statSync(path.join(producer, 'tsconfig.json')).mtimeMs);
  return fs.statSync(types).mtimeMs >= source ? null : `the test-world build is older than its source: run ${TEST_WORLD_BUILD_COMMAND}`;
}
