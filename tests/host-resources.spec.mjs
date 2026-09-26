import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeHostResources, hostResourcesFromOverride, hostResourcesFor, resourceThresholds, driveOf,
  HOST_RESOURCES_ENV, DEFAULT_MIN_FREE_DISK_GB, DEFAULT_MIN_FREE_RAM_PCT,
} from '../scripts/lib/host-resources.mjs';

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

test('the thresholds come from allocation.resources.*, falling back to the declared defaults', t => {
  assert.deepEqual(resourceThresholds(SETTINGS), { minFreeDiskGb: 20, minFreeRamPct: 15 });
  assert.deepEqual(resourceThresholds({}), { minFreeDiskGb: DEFAULT_MIN_FREE_DISK_GB, minFreeRamPct: DEFAULT_MIN_FREE_RAM_PCT });
  assert.equal(DEFAULT_MIN_FREE_DISK_GB, 20);
  assert.equal(DEFAULT_MIN_FREE_RAM_PCT, 15);
  assert.deepEqual(resourceThresholds({ resources: { minFreeDiskGb: 5, minFreeRamPct: 50 } }), { minFreeDiskGb: 5, minFreeRamPct: 50 });
  assert.deepEqual(resourceThresholds({ resources: { minFreeDiskGb: 0, minFreeRamPct: -3 } }),
    { minFreeDiskGb: 20, minFreeRamPct: 15 }, 'a non-positive threshold is not a floor — the default stands');
});

test('a healthy host reads ok with both drives and the RAM figures reported', t => {
  const p = probeHostResources({
    env: { TEMP: 'C:\\Temp' }, repo: 'D:\\repo', settings: SETTINGS,
    statfs: statfsOf({ 'C:\\Temp': gb(50), 'D:\\repo': gb(80) }),
    meminfo: mem(64e9, 32e9),
  });
  assert.equal(p.ok, true);
  assert.equal(p.lowDisk, false);
  assert.equal(p.lowRam, false);
  assert.equal(p.drive, 'C:', 'the smallest free figure binds the headline fields');
  assert.equal(p.freeDiskGb, 50);
  assert.equal(p.drives.length, 2);
  assert.deepEqual(p.drives.map(d => d.role), ['temp', 'repo']);
  assert.equal(p.totalRamBytes, 64e9);
  assert.equal(p.freeRamBytes, 32e9);
  assert.equal(p.freeRamPct, 50);
});

test('the worst of the two drives binds: a low repo drive refuses even with a roomy %TEMP% drive', t => {
  const p = probeHostResources({
    env: { TEMP: 'C:\\Temp' }, repo: 'D:\\repo', settings: SETTINGS,
    statfs: statfsOf({ 'C:\\Temp': gb(500), 'D:\\repo': gb(9.5) }),
    meminfo: mem(64e9, 32e9),
  });
  assert.equal(p.ok, false);
  assert.equal(p.lowDisk, true);
  assert.equal(p.lowRam, false);
  assert.equal(p.drive, 'D:');
  assert.equal(p.freeDiskGb, 9.5);
});

test('and the same the other way round: a low %TEMP% drive binds even with a roomy repo drive', t => {
  const p = probeHostResources({
    env: { TEMP: 'C:\\Temp' }, repo: 'D:\\repo', settings: SETTINGS,
    statfs: statfsOf({ 'C:\\Temp': gb(3), 'D:\\repo': gb(500) }),
    meminfo: mem(64e9, 32e9),
  });
  assert.equal(p.ok, false);
  assert.equal(p.lowDisk, true);
  assert.equal(p.drive, 'C:');
  assert.equal(p.freeDiskGb, 3);
});

test('a repo on the same drive as %TEMP% is measured once, not twice', t => {
  const seen = [];
  const p = probeHostResources({
    env: { TEMP: 'C:\\Temp' }, repo: 'C:\\src\\repo', settings: SETTINGS,
    statfs: (x) => { seen.push(x); return gb(50); },
    meminfo: mem(64e9, 32e9),
  });
  assert.equal(p.drives.length, 1);
  assert.deepEqual(seen, ['C:\\Temp']);
  assert.equal(p.ok, true);
});

test('threshold boundaries: exactly at the floor is room enough, one step under it is low', t => {
  const at = probeHostResources({
    env: { TEMP: 'C:\\Temp' }, repo: 'D:\\repo', settings: SETTINGS,
    statfs: statfsOf({ 'C:\\Temp': gb(20), 'D:\\repo': gb(20) }),
    meminfo: mem(100e9, 15e9), // exactly 15%
  });
  assert.equal(at.ok, true, 'free == min is admitted');
  assert.equal(at.lowDisk, false);
  assert.equal(at.lowRam, false);
  const under = probeHostResources({
    env: { TEMP: 'C:\\Temp' }, repo: 'D:\\repo', settings: SETTINGS,
    statfs: statfsOf({ 'C:\\Temp': gb(19.999), 'D:\\repo': gb(60) }),
    meminfo: mem(100e9, 14.9e9),
  });
  assert.equal(under.ok, false);
  assert.equal(under.lowDisk, true);
  assert.equal(under.lowRam, true, '14.9% < 15% is low');
});

test('a low-RAM host reads lowRam with the real percentage named', t => {
  const p = probeHostResources({
    env: { TEMP: 'C:\\Temp' }, repo: null, settings: SETTINGS,
    statfs: statfsOf({ 'C:\\Temp': gb(500) }),
    meminfo: mem(68e9, 6.4e9), // the Sept-26 host: ~9.4% free
  });
  assert.equal(p.ok, false);
  assert.equal(p.lowRam, true);
  assert.equal(p.lowDisk, false);
  assert.ok(Math.abs(p.freeRamPct - (6.4 / 68) * 100) < 0.01);
});

test('a drive the probe cannot read is reported with its error and does not count as low', t => {
  const p = probeHostResources({
    env: { TEMP: 'C:\\Temp' }, repo: 'D:\\repo', settings: SETTINGS,
    statfs: statfsOf({ 'D:\\repo': gb(50) }), // C:\\Temp throws ENOENT
    meminfo: mem(64e9, 32e9),
  });
  const temp = p.drives.find(d => d.role === 'temp');
  assert.equal(temp.freeDiskGb, null);
  assert.match(temp.error, /ENOENT/);
  assert.equal(p.ok, true, 'the measured drive is judged; an unreadable one does not block');
  assert.equal(p.drive, 'D:');
});

test('an unmeasurable RAM figure counts as unmeasured, not as zero free', t => {
  const p = probeHostResources({
    env: { TEMP: 'C:\\Temp' }, repo: null, settings: SETTINGS,
    statfs: statfsOf({ 'C:\\Temp': gb(50) }),
    meminfo: () => { throw new Error('no meminfo'); },
  });
  assert.equal(p.ok, true);
  assert.equal(p.lowRam, false);
});

test('the override seam supplies measurements and recomputes the verdicts on real thresholds', t => {
  const low = hostResourcesFromOverride({ drives: [{ drive: 'C:', path: 'C:\\Temp', freeDiskGb: 1 }], totalRamBytes: 64e9, freeRamBytes: 60e9 }, { settings: SETTINGS });
  assert.equal(low.ok, false);
  assert.equal(low.lowDisk, true);
  assert.equal(low.lowRam, false);
  assert.equal(low.drive, 'C:');
  assert.equal(low.freeDiskGb, 1);
  assert.equal(low.override, true);
  const flat = hostResourcesFromOverride({ freeDiskGb: 500, freeRamPct: 2 }, { settings: SETTINGS });
  assert.equal(flat.ok, false);
  assert.equal(flat.lowRam, true, 'a bare freeRamPct still judges RAM');
  const healthy = hostResourcesFromOverride({ freeDiskGb: 500, freeRamPct: 80 }, { settings: SETTINGS });
  assert.equal(healthy.ok, true);
});

test('hostResourcesFor honors STARCI_HOST_RESOURCES_JSON, else probes live; a test tree reports but never blocks', t => {
  const env = { TEMP: 'C:\\Temp', [HOST_RESOURCES_ENV]: JSON.stringify({ freeDiskGb: 0.5, freeRamPct: 90 }) };
  const p = hostResourcesFor({ env, settings: SETTINGS });
  assert.equal(p.ok, false);
  assert.equal(p.lowDisk, true);
  // No override inside node --test: the probe still measures (a spec host may legitimately be low) but ok stays true.
  const underTest = hostResourcesFor({
    env: { TEMP: 'C:\\Temp', NODE_TEST_CONTEXT: 'child-v8' }, settings: SETTINGS,
    statfs: statfsOf({ 'C:\\Temp': gb(1) }),
    meminfo: mem(64e9, 32e9),
  });
  assert.equal(underTest.lowDisk, true, 'the real measurement is still reported');
  assert.equal(underTest.ok, true);
  assert.equal(underTest.testContext, true);
  // And the override still wins inside a test tree — that is how the dispatch spec drives the guard.
  const forced = hostResourcesFor({
    env: { TEMP: 'C:\\Temp', NODE_TEST_CONTEXT: 'child-v8', [HOST_RESOURCES_ENV]: JSON.stringify({ freeDiskGb: 0.5, freeRamPct: 90 }) },
    settings: SETTINGS,
  });
  assert.equal(forced.ok, false);
  assert.equal(forced.lowDisk, true);
});

test('the probe falls back to os.tmpdir() when env.TEMP is unset', t => {
  const p = probeHostResources({
    env: {}, repo: null, settings: SETTINGS,
    statfs: () => gb(500), meminfo: mem(64e9, 32e9),
  });
  assert.equal(p.ok, true);
  assert.equal(p.drives.length, 1);
  assert.ok(p.drives[0].path, 'it measured a real path');
});

test('driveOf spells the binding drive the way the alert names it', t => {
  assert.equal(driveOf('C:\\Users\\Hi\\AppData\\Local\\Temp'), 'C:');
  assert.equal(driveOf('D:\\starci-lanes\\x'), 'D:');
  assert.equal(driveOf('C:/src/x'), 'C:');
  if (process.platform !== 'win32') assert.equal(driveOf('/tmp/x'), '/');
});
