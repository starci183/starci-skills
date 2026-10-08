import test from 'node:test';
import fs from 'node:fs';
import { parseYaml } from '../../engine/yaml.mjs';
import assert from 'node:assert/strict';
import { adaptiveCap } from '../../scripts/supervisor/workers.mjs';
import { DEFAULTS } from '../../scripts/machine/home.mjs';
import { validateConfig } from '../../engine/config.mjs';

test('the shipped default is no fix worker and a zero cap stays zero under queue and load', () => {
  assert.deepEqual([DEFAULTS.workers.base, DEFAULTS.workers.max], [0, 0]);
  assert.equal(adaptiveCap({ base: 0, max: 0, queued: 6 }).cap, 0);
  assert.equal(adaptiveCap({ base: 0, max: 0, queued: 6, load: { cpuBusy: 0.97, freeMem: 0.5 } }).cap, 0);
  assert.equal(adaptiveCap({ base: 0, max: 0, queued: 2, load: { cpuBusy: 0.9, freeMem: 0.5 } }).cap, 0);
});

test('a positive cap keeps its adaptive behaviour', () => {
  assert.equal(adaptiveCap({ base: 1, max: 3, queued: 4 }).cap, 3);
  assert.equal(adaptiveCap({ base: 4, max: 10, queued: 0, load: { cpuBusy: 0.97, freeMem: 0.5 } }).cap, 1);
});

test('the config validator accepts 0 and refuses 11 for supervisor.workers', () => {
  const example = parseYaml(fs.readFileSync(new URL('../../config.example.yaml', import.meta.url), 'utf8'));
  const config = (workers) => ({ ...example, supervisor: { ...example.supervisor, workers } });
  assert.doesNotThrow(() => validateConfig(config({ base: 0, max: 0 })));
  assert.throws(() => validateConfig(config({ base: 0, max: 11 })), /supervisor\.workers must be/);
});
