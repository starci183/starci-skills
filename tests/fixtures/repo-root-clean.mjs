// The clean half of repo-root-guard.spec.mjs: a spec that needs a fixture under the repository root and removes the directory it made, parent included.
import test, { after } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const PARENT = path.join(REPO, '.tmp-root-guard-clean-fixture');

after(() => { fs.rmSync(PARENT, { recursive: true, force: true }); });

test('uses a directory under the repository root and removes it', async () => {
  fs.mkdirSync(path.join(PARENT, 'inner'), { recursive: true });
  fs.writeFileSync(path.join(PARENT, 'inner', 'note.txt'), 'temporary\n');
  await fs.promises.writeFile(path.join(PARENT, 'inner', 'later.txt'), 'temporary\n');
});
