// The deliberately dirty half of temp-leak-guard.spec.mjs: a spec that mkdtemps and never removes the dir.
// Run only as a child `node --test` file under the isolated-temp preload - the parent's temp-root guard must
// name this dir and fail the run.
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('leaves a temp dir behind', () => {
  fs.mkdtempSync(path.join(os.tmpdir(), 'starci-leak-fixture-'));
});
