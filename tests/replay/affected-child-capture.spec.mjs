// Replay of the native old deploy child capture: the real affected selector produces a diagnostic graph above its transport buffer.
// The same full selected set is executed with controlled spec results; native child capture must still read every verdict and the receipt.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { readModuleJson } from '../../engine/runtime-root.mjs';
import { testAffected } from '../../scripts/supervisor/affected-test.mjs';
import { runNode } from '../../scripts/api/node/run-node.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

test('a large diagnostic graph stays available in the plan while a complete run receipt fits the native child capture', async (t) => {
  const root = mkdtemp(t, 'starci-affected-capture-');
  for (const dir of ['scripts/lib', 'tests']) fs.mkdirSync(path.join(root, dir), { recursive: true });
  const d = {
    root, policy: readModuleJson('modules', 'supervisor', 'affected-tests.yaml'), sources: [], exists: () => true,
    mergeBase: () => 'a'.repeat(40), revParse: () => 'b'.repeat(40), diff: () => ({ status: 0, stdout: '' }), lsFiles: () => ({ status: 0, stdout: '' }),
    changedFiles: () => ['scripts/lib/many.mjs'], progress: () => {},
    hostSample: () => ({ logicalThreads: 16, cpuBusy: 0, totalRamBytes: 64 * 1024 ** 3, freeRamBytes: 48 * 1024 ** 3 }),
  };
  const context = (args) => ({ args: { root, ...args }, cwd: root });
  const names = Array.from({ length: 80 }, (_, index) => `value${index}`);
  const moduleText = (value) => names.map((name) => `export const ${name} = ${value};`).join('\n');
  fs.writeFileSync(path.join(d.root, 'scripts/lib/many.mjs'), moduleText(1));
  d.show = () => ({ status: 0, stdout: moduleText(0) });
  const imports = `import { ${names.join(', ')} } from '../scripts/lib/many.mjs';\n`;
  const files = Array.from({ length: 128 }, (_, index) => `tests/consumer-${index}.spec.mjs`);
  for (const file of files) fs.writeFileSync(path.join(d.root, file), imports);
  const plan = await testAffected(context({ plan: true }), d);
  const capture = (data, name) => {
    const file = path.join(d.root, name);
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    return runNode(['-e', 'process.stdout.write(require("node:fs").readFileSync(process.argv[1]))', file]);
  };
  assert.equal(capture(plan.data, 'plan.json').error?.code, 'ENOBUFS', 'the full diagnostic graph exceeds the default native capture');
  const executed = [];
  d.execNode = (args) => { executed.push(args.at(-1)); return Promise.resolve({ error: null, stdout: "ok", stderr: "" }); };
  const run = await testAffected(context({ run: true, 'no-cache': true }), d);
  const child = capture(run.data, 'run.json');
  assert.equal(child.error, undefined, child.error?.message);
  assert.equal(child.status, 0);
  const proof = JSON.parse(child.stdout);
  assert.deepEqual(proof.scope, plan.data.scope, 'bounded transport changes no selected file');
  assert.deepEqual(executed.sort(), files.sort(), 'every selected file ran');
  assert.deepEqual([proof.receipt.ok, proof.receipt.passed, proof.receipt.total], [true, files.length, files.length]);
  assert.equal(proof.results.length, files.length);
  assert.equal(plan.data.symbols.length, names.length, 'the plan retains the full diagnostic graph');
});
