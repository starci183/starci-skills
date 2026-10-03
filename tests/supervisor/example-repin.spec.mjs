// example-repin.spec.mjs - the example re-pin of `starci release publish` (scripts/lib/example-repin.mjs): the only `starci` bin is @starci/cli's (the hfs package has no bin), so an example that
// still declares @starci/hfs is moved to @starci/cli at its pin, its section stays sorted, and every other pin is set to knowledge/hfs/canon-pins.yaml. Nothing is installed or published here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { repinExample } from '../../scripts/lib/example-repin.mjs';

const PINS = { '@starci/cli': { version: '1.0.0' }, '@starci/hfs': { version: '4.0.9' }, '@starci/jest-preset': { version: '2.2.4' }, '@starci/test-world': { version: '1.2.0' } };
const tmp = (t) => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-repin-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  return dir;
};
const SHOP = `${JSON.stringify({
  name: 'shop', private: true,
  dependencies: { '@nestjs/common': '11.2.5' },
  devDependencies: { '@starci/eslint-canon-be': '3.0.9', '@starci/hfs': '4.0.7', '@starci/jest-preset': '2.2.2', '@starci/test-world': '1.2.0', eslint: '9.39.5' },
}, null, 2)}\n`;
/** An example `shop` under a fresh root with `text` as its package.json: {root, file}. */
const example = (t, text) => {
  const root = tmp(t);
  const file = path.join(root, 'examples', 'shop', 'package.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return { root, file };
};

test('an example that declares @starci/hfs and not @starci/cli moves the entry to the cli at its pin, sorted, with its formatting kept', (t) => {
  const { root, file } = example(t, SHOP);
  assert.equal(repinExample(root, 'shop', PINS, true).changed, 2, 'the swap and the jest-preset drift');
  const text = fs.readFileSync(file, 'utf8');
  const pkg = JSON.parse(text);
  assert.equal(pkg.devDependencies['@starci/hfs'], undefined);
  assert.equal(pkg.devDependencies['@starci/cli'], '1.0.0');
  assert.deepEqual(Object.keys(pkg.devDependencies), ['@starci/cli', '@starci/eslint-canon-be', '@starci/jest-preset', '@starci/test-world', 'eslint'], 'the section stays in npm order');
  assert.ok(text.endsWith('}\n') && text.includes('\n  "devDependencies"'), 'two-space indent and the final newline are kept');
  assert.equal(repinExample(root, 'shop', PINS, false).changed, 0, 'a re-pinned example has no drift left and no second swap');
});

test('CRLF files stay CRLF through the swap', (t) => {
  const { root, file } = example(t, SHOP.replace(/\n/g, '\r\n'));
  repinExample(root, 'shop', PINS, true);
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(text.includes('\r\n') && !/[^\r]\n/.test(text), 'every line ending is CRLF');
  assert.equal(JSON.parse(text).devDependencies['@starci/cli'], '1.0.0');
});

test('nothing swaps when the cli is already declared, the pin set has no cli, or the package never named the hfs package; the other pins still move', (t) => {
  const both = `${JSON.stringify({ devDependencies: { '@starci/cli': '1.0.0', '@starci/hfs': '4.0.7' } }, null, 2)}\n`;
  const kept = example(t, both);
  assert.equal(repinExample(kept.root, 'shop', PINS, true).changed, 1, 'only the hfs version moves');
  assert.deepEqual(JSON.parse(fs.readFileSync(kept.file, 'utf8')).devDependencies, { '@starci/cli': '1.0.0', '@starci/hfs': '4.0.9' });
  const noCli = example(t, SHOP);
  const { '@starci/cli': omitted, ...withoutCli } = PINS;
  assert.equal(omitted.version, '1.0.0');
  assert.equal(repinExample(noCli.root, 'shop', withoutCli, true).changed, 2, 'hfs and jest-preset versions only');
  assert.equal(JSON.parse(fs.readFileSync(noCli.file, 'utf8')).devDependencies['@starci/cli'], undefined);
  const plain = `${JSON.stringify({ dependencies: { eslint: '9.39.5' } }, null, 2)}\n`;
  const untouched = example(t, plain);
  assert.equal(repinExample(untouched.root, 'shop', PINS, true).changed, 0);
  assert.equal(fs.readFileSync(untouched.file, 'utf8'), plain);
});

test('plan mode counts the swap beside the version drift and writes nothing; an absent example is skipped and a path-like name is refused', (t) => {
  const { root, file } = example(t, SHOP);
  const plan = repinExample(root, 'shop', PINS, false);
  assert.deepEqual([plan.present, plan.changed], [true, 2]);
  assert.equal(fs.readFileSync(file, 'utf8'), SHOP, 'plan mode writes nothing');
  assert.deepEqual(repinExample(root, 'absent', PINS, false), { name: 'absent', directory: path.join(root, 'examples', 'absent'), present: false, changed: 0 });
  assert.throws(() => repinExample(root, '../escape', PINS, false), /invalid example name/);
});
