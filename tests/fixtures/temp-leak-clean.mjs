// The clean half of temp-leak-guard.spec.mjs: a spec that removes its temp dir in t.after. The parent's
// temp-root guard must let this run exit 0.
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('removes its temp dir', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-leak-clean-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
});
