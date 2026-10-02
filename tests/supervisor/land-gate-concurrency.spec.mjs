import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { specConcurrency, runSpecFiles } from '../../scripts/supervisor/land.mjs';
import { parseYaml } from '../../engine/yaml.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const tmp = (t) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-land-conc-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 })); return dir; };

// Two probe specs rendezvous through a marker file: under `--test-concurrency=2` both run at once and each sees
// the other's marker; under `--test-concurrency=1` the first finishes alone, so a waiting probe times out red.
test('the land gate runs specs at the concurrency runtimes.yaml declares, not a literal', async (t) => {
  const declared = parseYaml(fs.readFileSync(path.join(root, 'modules', 'models', 'runtimes.yaml'), 'utf8')).allocation.landGate.specConcurrency;
  assert.equal(specConcurrency(), declared);
  // runSpecFiles passes that number to node --test as --test-concurrency: prove it by rendezvous.
  const dir = tmp(t);
  const probe = (name, waitFor) => fs.writeFileSync(path.join(dir, `${name}.spec.mjs`), `import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test(${JSON.stringify(name)}, async () => {
  fs.writeFileSync(${JSON.stringify(path.join(dir, name + '.start'))}, 'x');
  const deadline = Date.now() + 8_000;
  while (!fs.existsSync(${JSON.stringify(path.join(dir, waitFor + '.start'))})) {
    assert.ok(Date.now() < deadline, 'ran alone: --test-concurrency serialized the probes');
    await new Promise((r) => setTimeout(r, 25));
  }
});
`);
  probe('aa', 'bb'); probe('bb', 'aa');
  const parallel = runSpecFiles({ dir, files: ['aa.spec.mjs', 'bb.spec.mjs'], concurrency: 2, timeout: 120_000 });
  assert.equal(parallel.ok, true, `parallel run failed: ${parallel.stderr || JSON.stringify(parallel.failures)}`);
  const serial = runSpecFiles({ dir, files: ['aa.spec.mjs', 'bb.spec.mjs'], concurrency: 1, timeout: 120_000 });
  assert.equal(serial.ok, false, 'concurrency=1 must serialize the probes');
  assert.ok((serial.failures ?? []).some((f) => f.file === 'aa.spec.mjs'), JSON.stringify(serial.failures));
});
