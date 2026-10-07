import test from 'node:test';
import assert from 'node:assert/strict'; import os from 'node:os'; import path from 'node:path';
import {
  probeHostResources, hostResourcesFromOverride, hostResourcesFor, resourceThresholds, driveOf,
  HOST_RESOURCES_ENV, memoryProbe,
} from '../../scripts/machine/host-resources.mjs';
import { allocationSettings } from '../../engine/config.mjs';
import { TEMP_ROOT_ENV } from '../../engine/temp-root.mjs';
import * as hostResources from '../../scripts/machine/host-resources.mjs';

// Spec item 3: the host-resources guard. The probe measures the drive holding %TEMP% and the repo's
// drive when it differs, guards on the worst of them, and reads RAM through the worker cap's own probe
// (memoryProbe). Verdicts compare against allocation.resources.minFreeDiskGb / minFreeRamPct with the
// declared defaults while runtimes.yaml omits them. Every seam ({statfs, meminfo} or the
// STARCI_HOST_RESOURCES_JSON override) feeds the same boundary math.

const gb = (n) => ({ bavail: (n * 1e9) / 4096, bsize: 4096 }); // a statfs whose usable free is n GB
const statfsOf = (byPath) => (p) => {
  if (typeof byPath[p] === 'function') return byPath[p]();
  if (byPath[p] == null) throw Object.assign(new Error(`ENOENT: no such dir ${p}`), { code: 'ENOENT' });
  return byPath[p];
};
const mem = (totalRamBytes, freeRamBytes) => () => ({ totalRamBytes, freeRamBytes });
const SETTINGS = { resources: { minFreeDiskGb: 20, minFreeRamPct: 15 } };
const DRIVE = path.parse(os.tmpdir()).root, TEMP = `${DRIVE}Temp`, DRV = DRIVE.slice(0, 2); // the drive holding %TEMP%
const DRIVE2 = `${String.fromCharCode(DRIVE.charCodeAt(0) ^ 1)}:\\`, REPO = `${DRIVE2}repo`, DRV2 = `${DRIVE2[0]}:`; // a second drive letter
const TWO_DRIVES = process.platform !== 'win32' && 'a second drive letter exists on Windows only: a POSIX path has the one root /, covered by the driveOf and same-root cases';
const REPO_SAME = `${DRIVE}src\\repo`;

const SHIPPED = allocationSettings().resources;

test('the floors come from the shipped policy; the owner config overrides key by key; nothing is a code constant', t => {
  assert.deepEqual(resourceThresholds(SETTINGS, null), { minFreeDiskGb: 20, minFreeDiskPct: null, minFreeRamPct: 15 });
  assert.deepEqual(resourceThresholds(null, null), { minFreeDiskGb: SHIPPED.minFreeDiskGb, minFreeDiskPct: null, minFreeRamPct: SHIPPED.minFreeRamPct },
    'the default is whatever modules/models/runtimes.yaml declares');
  assert.equal(Object.keys(hostResources).some((name) => /^DEFAULT_MIN_FREE/.test(name)), false, 'no numeric default constant is exported');
  assert.deepEqual(resourceThresholds(SETTINGS, { resources: { minFreeDiskGb: 7 } }), { minFreeDiskGb: 7, minFreeDiskPct: null, minFreeRamPct: 15 }, 'config.yaml overrides the shipped number');
  assert.deepEqual(resourceThresholds(SETTINGS, { resources: { minFreeDiskPct: 1, minFreeRamPct: 40 } }), { minFreeDiskGb: 20, minFreeDiskPct: 1, minFreeRamPct: 40 });
  assert.deepEqual(resourceThresholds(SETTINGS, { resources: null }), { minFreeDiskGb: 20, minFreeDiskPct: null, minFreeRamPct: 15 });
  assert.deepEqual(resourceThresholds(SETTINGS, { resources: { minFreeDiskGb: null } }), { minFreeDiskGb: 20, minFreeDiskPct: null, minFreeRamPct: 15 }, 'null leaves the shipped number');
});

test('a shipped policy without a floor, or with an invalid one, is an error - never a silent number', t => {
  assert.throws(() => resourceThresholds({}, null), /allocation.resources.minFreeDiskGb must declare a positive number/);
  assert.throws(() => resourceThresholds({ resources: { minFreeDiskGb: 5 } }, null), /minFreeRamPct must declare a positive number/);
  assert.throws(() => resourceThresholds({ resources: { minFreeDiskGb: 0, minFreeRamPct: 10 } }, null), /minFreeDiskGb must be a number above 0/);
  assert.throws(() => resourceThresholds({ resources: { minFreeDiskGb: 5, minFreeRamPct: -3 } }, null), /minFreeRamPct must be a number above 0/);
  assert.throws(() => resourceThresholds(SETTINGS, { resources: { minFreeDiskGb: 0 } }), /resources/);
  assert.throws(() => resourceThresholds(SETTINGS, { resources: { minFreeDiskPct: 101 } }), /minFreeDiskPct/);
  assert.throws(() => resourceThresholds(SETTINGS, { resources: { bogus: 1 } }), /unknown key bogus/);
});

const gbOf = (free, total) => ({ bavail: (free * 1e9) / 4096, blocks: (total * 1e9) / 4096, bsize: 4096 });

test('the percentage floor: when both are set the larger requirement applies', t => {
  const config = { resources: { minFreeDiskGb: 5, minFreeDiskPct: 1 } };
  const probe = (free, total) => probeHostResources({ env: { TEMP }, settings: SETTINGS, config, statfs: () => gbOf(free, total), meminfo: mem(64e9, 32e9) });
  const big = probe(15, 2000); // 1% of 2000 GB is 20 GB, over the 5 GB floor
  assert.equal(big.lowDisk, true);
  assert.equal(big.requiredDiskGb, 20);
  assert.equal(probe(20, 2000).lowDisk, false, 'exactly at the larger requirement is room enough');
  const small = probe(6, 100); // 1% of 100 GB is 1 GB, under the 5 GB floor: 5 GB binds
  assert.equal(small.requiredDiskGb, 5);
  assert.equal(small.lowDisk, false);
  assert.equal(probe(4, 100).lowDisk, true);
  assert.equal(big.thresholds.minFreeDiskPct, 1);
});

test('the percentage floor alone needs the drive size; an override drive without one falls back to the GB floor', t => {
  const config = { resources: { minFreeDiskPct: 10 } };
  const withTotal = hostResourcesFromOverride({ drives: [{ drive: DRV, path: TEMP, freeDiskGb: 30, totalDiskGb: 500 }], freeRamPct: 80 }, { settings: SETTINGS, config });
  assert.equal(withTotal.requiredDiskGb, 50);
  assert.equal(withTotal.lowDisk, true);
  const noTotal = hostResourcesFromOverride({ freeDiskGb: 21, freeRamPct: 80 }, { settings: SETTINGS, config });
  assert.equal(noTotal.requiredDiskGb, 20, 'no size known: minFreeDiskGb alone');
  assert.equal(noTotal.lowDisk, false);
});

test('the gate measures the drive of the configured temp root, not the OS temp drive', { skip: TWO_DRIVES }, t => {
  const configured = `${DRIVE2}runtime-temp`;
  const seen = [];
  const p = probeHostResources({
    env: { TEMP, [TEMP_ROOT_ENV]: configured }, settings: SETTINGS, config: null,
    statfs: (x) => { seen.push(x); return gb(3); }, meminfo: mem(64e9, 32e9),
  });
  assert.deepEqual(seen, [configured]);
  assert.equal(p.drives[0].drive, DRV2);
  assert.equal(p.drive, DRV2);
  assert.equal(p.lowDisk, true);
  const fromConfig = probeHostResources({
    env: { TEMP }, settings: SETTINGS, config: { roots: { temp: configured } },
    statfs: statfsOf({ [configured]: gb(500), [TEMP]: gb(1) }), meminfo: mem(64e9, 32e9),
  });
  assert.equal(fromConfig.drives[0].path, configured, 'config.yaml roots.temp moves the measured drive too');
  assert.equal(fromConfig.lowDisk, false);
});

test('a temp root that is not made yet is measured on its nearest existing ancestor', t => {
  const root = path.join(TEMP, 'runtime-temp', 'deeper');
  const p = probeHostResources({
    env: { TEMP, [TEMP_ROOT_ENV]: root }, settings: SETTINGS, config: null,
    statfs: statfsOf({ [TEMP]: gb(50) }), meminfo: mem(64e9, 32e9),
  });
  assert.equal(p.drives[0].freeDiskGb, 50);
  assert.equal(p.drives[0].path, root);
});

test('memoryProbe is the one RAM sample', t => {
  assert.deepEqual(memoryProbe({ mem: { totalmem: () => 100, freemem: () => 25 } }), { totalRamBytes: 100, freeRamBytes: 25, freeMem: 0.25 });
});

test('a healthy host reads ok with both drives and the RAM figures reported', { skip: TWO_DRIVES }, t => {
  const p = probeHostResources({
    env: { TEMP }, repo: REPO, settings: SETTINGS, config: null,
    statfs: statfsOf({ [TEMP]: gb(50), [REPO]: gb(80) }),
    meminfo: mem(64e9, 32e9),
  });
  assert.equal(p.ok, true); assert.equal(p.lowDisk, false); assert.equal(p.lowRam, false);
  assert.equal(p.drive, DRV, 'the smallest free figure binds the headline fields');
  assert.equal(p.freeDiskGb, 50); assert.equal(p.drives.length, 2);
  assert.deepEqual(p.drives.map(d => d.role), ['temp', 'repo']);
  assert.equal(p.totalRamBytes, 64e9); assert.equal(p.freeRamBytes, 32e9); assert.equal(p.freeRamPct, 50);
});

test('the worst of the two drives binds: a low repo drive refuses even with a roomy %TEMP% drive', { skip: TWO_DRIVES }, t => {
  const p = probeHostResources({
    env: { TEMP }, repo: REPO, settings: SETTINGS, config: null,
    statfs: statfsOf({ [TEMP]: gb(500), [REPO]: gb(9.5) }),
    meminfo: mem(64e9, 32e9),
  });
  assert.equal(p.ok, false);
  assert.equal(p.lowDisk, true);
  assert.equal(p.lowRam, false);
  assert.equal(p.drive, DRV2);
  assert.equal(p.freeDiskGb, 9.5);
});

test('and the same the other way round: a low %TEMP% drive binds even with a roomy repo drive', t => {
  const p = probeHostResources({
    env: { TEMP }, repo: REPO, settings: SETTINGS, config: null,
    statfs: statfsOf({ [TEMP]: gb(3), [REPO]: gb(500) }),
    meminfo: mem(64e9, 32e9),
  });
  assert.equal(p.ok, false);
  assert.equal(p.lowDisk, true);
  assert.equal(p.drive, DRV);
  assert.equal(p.freeDiskGb, 3);
});

test('a repo on the same drive as %TEMP% is measured once, not twice', t => {
  const seen = [];
  const p = probeHostResources({
    env: { TEMP }, repo: REPO_SAME, settings: SETTINGS, config: null,
    statfs: (x) => { seen.push(x); return gb(50); },
    meminfo: mem(64e9, 32e9),
  });
  assert.equal(p.drives.length, 1);
  assert.deepEqual(seen, [TEMP]);
  assert.equal(p.ok, true);
});

test('threshold boundaries: exactly at the floor is room enough, one step under it is low', t => {
  const at = probeHostResources({
    env: { TEMP }, repo: REPO, settings: SETTINGS, config: null,
    statfs: statfsOf({ [TEMP]: gb(20), [REPO]: gb(20) }),
    meminfo: mem(100e9, 15e9), // exactly 15%
  });
  assert.equal(at.ok, true, 'free == min is admitted');
  assert.equal(at.lowDisk, false);
  assert.equal(at.lowRam, false);
  const under = probeHostResources({
    env: { TEMP }, repo: REPO, settings: SETTINGS, config: null,
    statfs: statfsOf({ [TEMP]: gb(19.999), [REPO]: gb(60) }),
    meminfo: mem(100e9, 14.9e9),
  });
  assert.equal(under.ok, false);
  assert.equal(under.lowDisk, true);
  assert.equal(under.lowRam, true, '14.9% < 15% is low');
});

test('a low-RAM host reads lowRam with the real percentage named', t => {
  const p = probeHostResources({
    env: { TEMP }, repo: null, settings: SETTINGS, config: null,
    statfs: statfsOf({ [TEMP]: gb(500) }),
    meminfo: mem(68e9, 6.4e9), // the Sept-26 host: ~9.4% free
  });
  assert.equal(p.ok, false);
  assert.equal(p.lowRam, true);
  assert.equal(p.lowDisk, false);
  assert.ok(Math.abs(p.freeRamPct - (6.4 / 68) * 100) < 0.01);
});

test('a drive the probe cannot read is reported with its error and does not count as low', { skip: TWO_DRIVES }, t => {
  const p = probeHostResources({
    env: { TEMP }, repo: REPO, settings: SETTINGS, config: null,
    statfs: statfsOf({ [REPO]: gb(50) }), // TEMP throws ENOENT
    meminfo: mem(64e9, 32e9),
  });
  const temp = p.drives.find(d => d.role === 'temp');
  assert.equal(temp.freeDiskGb, null);
  assert.match(temp.error, /ENOENT/);
  assert.equal(p.ok, true, 'the measured drive is judged; an unreadable one does not block');
  assert.equal(p.drive, DRV2);
});

test('an unmeasurable RAM figure counts as unmeasured, not as zero free', t => {
  const p = probeHostResources({
    env: { TEMP }, repo: null, settings: SETTINGS, config: null,
    statfs: statfsOf({ [TEMP]: gb(50) }),
    meminfo: () => { throw new Error('no meminfo'); },
  });
  assert.equal(p.ok, true);
  assert.equal(p.lowRam, false);
});

test('the override seam supplies measurements and recomputes the verdicts on real thresholds', t => {
  const low = hostResourcesFromOverride({ drives: [{ drive: DRV, path: TEMP, freeDiskGb: 1 }], totalRamBytes: 64e9, freeRamBytes: 60e9 }, { settings: SETTINGS, config: null });
  assert.equal(low.ok, false);
  assert.equal(low.lowDisk, true);
  assert.equal(low.lowRam, false);
  assert.equal(low.drive, DRV);
  assert.equal(low.freeDiskGb, 1);
  assert.equal(low.override, true);
  const flat = hostResourcesFromOverride({ freeDiskGb: 500, freeRamPct: 2 }, { settings: SETTINGS, config: null });
  assert.equal(flat.ok, false);
  assert.equal(flat.lowRam, true, 'a bare freeRamPct still judges RAM');
  const healthy = hostResourcesFromOverride({ freeDiskGb: 500, freeRamPct: 80 }, { settings: SETTINGS, config: null });
  assert.equal(healthy.ok, true);
});

test('hostResourcesFor honors STARCI_HOST_RESOURCES_JSON, else probes live; a test tree reports but never blocks', t => {
  const env = { TEMP, [HOST_RESOURCES_ENV]: JSON.stringify({ freeDiskGb: 0.5, freeRamPct: 90 }) };
  const p = hostResourcesFor({ env, settings: SETTINGS, config: null });
  assert.equal(p.ok, false);
  assert.equal(p.lowDisk, true);
  // No override inside node --test: the probe still measures (a spec host may legitimately be low) but ok stays true.
  const underTest = hostResourcesFor({
    env: { TEMP, NODE_TEST_CONTEXT: 'child-v8' }, settings: SETTINGS, config: null,
    statfs: statfsOf({ [TEMP]: gb(1) }),
    meminfo: mem(64e9, 32e9),
  });
  assert.equal(underTest.lowDisk, true, 'the real measurement is still reported');
  assert.equal(underTest.ok, true);
  assert.equal(underTest.testContext, true);
  // And the override still wins inside a test tree — that is how the dispatch spec drives the guard.
  const forced = hostResourcesFor({
    env: { TEMP, NODE_TEST_CONTEXT: 'child-v8', [HOST_RESOURCES_ENV]: JSON.stringify({ freeDiskGb: 0.5, freeRamPct: 90 }) },
    settings: SETTINGS, config: null,
  });
  assert.equal(forced.ok, false);
  assert.equal(forced.lowDisk, true);
});

test('the probe falls back to os.tmpdir() when env.TEMP is unset', t => {
  const p = probeHostResources({
    env: {}, repo: null, settings: SETTINGS, config: null,
    statfs: () => gb(500), meminfo: mem(64e9, 32e9),
  });
  assert.equal(p.ok, true);
  assert.equal(p.drives.length, 1);
  assert.ok(p.drives[0].path, 'it measured a real path');
});

test('driveOf spells the binding drive the way the alert names it', t => {
  if (process.platform === 'win32') {
    assert.equal(driveOf(os.tmpdir()), DRV);
    assert.equal(driveOf(`${DRIVE2}starci-lanes\\x`), DRV2);
    assert.equal(driveOf(`${DRIVE.replace(/\\/g, '/')}src/x`), DRV);
  } else {
    assert.equal(driveOf(os.tmpdir()), '/');
    assert.equal(driveOf('/tmp/x'), '/');
  }
});
