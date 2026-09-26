// The host-housekeeping and resource-guard contract lives in modules/models/runtimes.yaml
// `allocation`, read through engine/config.mjs allocationSettings(); a housekeeping or
// admission script never carries a literal of its own (same rule as recovery-timings.spec.mjs
// holds for the cadence windows). These specs pin the keys, their types and the declared
// temp-entry prefix list - including that the list still covers every mkdtemp prefix the
// spec suite creates under os.tmpdir().
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../engine/yaml.mjs';
import { allocationSettings } from '../engine/config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNTIMES = parseYaml(fs.readFileSync(path.join(ROOT, 'modules/models/runtimes.yaml'), 'utf8'));
const HK = RUNTIMES.allocation?.housekeeping;
const RES = RUNTIMES.allocation?.resources;

test('allocation.housekeeping declares every retention window, prefix list and root', () => {
  assert.ok(HK && typeof HK === 'object' && !Array.isArray(HK), 'allocation.housekeeping is declared');
  // The measured windows (2026-09-26): temp entries 2 days, agent sessions 3, Claude transcripts 7,
  // the archive kept 30, StarCi logs 14; an idle landed or never-started lane worktree 1.
  const windows = {
    tmpMaxAgeMs: 172_800_000,
    sessionArchiveAfterMs: 259_200_000,
    claudeTranscriptArchiveAfterMs: 604_800_000,
    archiveMaxAgeMs: 2_592_000_000,
    logMaxAgeMs: 1_209_600_000,
    laneGraceMs: 86_400_000,
    gitIndexLockStaleMs: 300_000,
  };
  for (const [key, want] of Object.entries(windows)) {
    assert.equal(HK[key], want, `housekeeping.${key}`);
    assert.ok(Number.isInteger(HK[key]) && HK[key] > 0, `housekeeping.${key} is a positive integer of ms`);
  }
  assert.equal(HK.archiveRoot, 'D:/starci-archive');
  assert.equal(HK.lanesRoot, 'D:/starci-lanes');
  assert.ok(Array.isArray(HK.tmpPrefixes) && HK.tmpPrefixes.length >= 10, 'tmpPrefixes is a declared list');
  for (const prefix of HK.tmpPrefixes) {
    assert.equal(typeof prefix, 'string', 'every tmpPrefixes entry is a string');
    assert.ok(prefix.length >= 3 && !/\s/.test(prefix), `tmpPrefixes entry ${JSON.stringify(prefix)} is specific, never a bare glob`);
  }
  // The runtime temp families measured on 2026-09-26 all stay declared.
  for (const prefix of ['starci', 'starci-w2', 'evidence', 'sup-k', 'work-v3', 'scoped-lint', 'si-', 'w1-', 'nivo-', 'orca-spec'])
    assert.ok(HK.tmpPrefixes.includes(prefix), `tmpPrefixes keeps ${prefix}`);
});

test('allocation.resources declares the disk and RAM floors the admission guard reads', () => {
  assert.ok(RES && typeof RES === 'object' && !Array.isArray(RES), 'allocation.resources is declared');
  assert.equal(RES.minFreeDiskGb, 20);
  assert.equal(RES.minFreeRamPct, 15);
  assert.ok(Number.isFinite(RES.minFreeDiskGb) && RES.minFreeDiskGb > 0, 'minFreeDiskGb is a positive number');
  assert.ok(Number.isFinite(RES.minFreeRamPct) && RES.minFreeRamPct > 0 && RES.minFreeRamPct <= 100, 'minFreeRamPct is a percent');
});

test('engine/config.mjs allocationSettings exposes both blocks to the scripts that read them', () => {
  const allocation = allocationSettings();
  assert.deepEqual(Object.keys(allocation.housekeeping).sort(),
    ['archiveMaxAgeMs', 'archiveRoot', 'claudeTranscriptArchiveAfterMs', 'gitIndexLockStaleMs', 'laneGraceMs', 'lanesRoot', 'logMaxAgeMs',
      'sessionArchiveAfterMs', 'tmpMaxAgeMs', 'tmpPrefixes']);
  assert.deepEqual(allocation.resources, { minFreeDiskGb: 20, minFreeRamPct: 15 });
});

test('housekeeping.tmpPrefixes covers every temp prefix the spec suite creates under os.tmpdir()', () => {
  const prefixes = new Set();
  const testsDir = path.join(ROOT, 'tests');
  const self = path.basename(fileURLToPath(import.meta.url));
  for (const file of fs.readdirSync(testsDir).filter((name) => name.endsWith('.mjs') && name !== self)) {
    const src = fs.readFileSync(path.join(testsDir, file), 'utf8');
    // Direct fixtures: fs.mkdtempSync(path.join(os.tmpdir(), ... with a string literal or the
    // static head of a template literal.
    for (const m of src.matchAll(/mkdtempSync\(\s*path\.join\(\s*os\.tmpdir\(\)\s*,\s*'([^']+)'/g)) prefixes.add(m[1]);
    for (const m of src.matchAll(/mkdtempSync\(\s*path\.join\(\s*os\.tmpdir\(\)\s*,\s*`([^`]*)`/g)) {
      const head = m[1].split('${')[0];
      if (head) prefixes.add(head);
    }
    // Helper fixtures: a (t, prefix) wrapper around mkdtempSync gets its prefix at the call
    // site - every fixture prefix is spelled '<name>-'.
    for (const m of src.matchAll(/\b\w+\(\s*t\s*,\s*'([a-z0-9][a-z0-9-]*-)'/g)) prefixes.add(m[1]);
  }
  assert.ok(prefixes.size > 50, `the scan found the suite's fixture prefixes (got ${prefixes.size})`);
  for (const prefix of prefixes)
    assert.ok(HK.tmpPrefixes.some((declared) => prefix.startsWith(declared)),
      `tmpPrefixes covers spec fixture prefix ${JSON.stringify(prefix)}`);
});
