// The deliberately dirty half of repo-root-guard.spec.mjs: a spec that makes a directory and a file under the repository root and never removes them.
// Run only as a child `node --test` file under the isolated-temp preload - the repo-root guard must name the leftover and fail the run.
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../', import.meta.url));

test('leaves a directory under the repository root', () => {
  const dir = path.join(REPO, '.tmp-root-guard-fixture', 'inner');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'note.txt'), 'left behind\n');
});
