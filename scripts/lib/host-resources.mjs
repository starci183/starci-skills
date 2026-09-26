// host-resources.mjs — the host capacity probe `api dispatch --spawn` reads before launching a worker
// (spec item 3: disk and RAM guards on the existing admission path). A starved host is a typed WAIT
// (reason 'host-resources-low', waiting:true), never a rejection: nothing is spawned, nothing is
// recorded, and every dispatch re-probes so admission recovers on its own once there is room again.
//
//   { ok, lowDisk, lowRam, drive, freeDiskGb, totalRamBytes, freeRamBytes, freeRamPct, drives, thresholds }
//
// Disk is measured on the drive holding %TEMP% and on the repo's drive when it differs — `drives`
// reports both and the WORST one binds (drive/freeDiskGb name it). RAM reuses the worker cap's probe
// (memoryProbe, scripts/supervisor/workers.mjs — `workers.mjs cap` reads the same machine) rather than
// a second memory sample. Thresholds come from modules/models/runtimes.yaml
// `allocation.resources.minFreeDiskGb` (default 20) and `minFreeRamPct` (default 15) via
// engine/config.mjs allocationSettings().
//
// Seams: `statfs` and `meminfo` inject the raw reads in specs; STARCI_HOST_RESOURCES_JSON is the
// probe override a spec (or the watchdog) hands the dispatch CLI — its JSON supplies MEASUREMENTS
// ({drives:[{drive,path,freeDiskGb}], totalRamBytes, freeRamBytes, freeRamPct} or the flat
// {freeDiskGb, freeRamPct} shorthand) and the verdicts are computed against the real thresholds, so an
// override exercises the same boundary math the live probe does. Inside a node --test process tree
// (NODE_TEST_CONTEXT — the same seam engine/ledger-db.mjs reads for its registry) with no override the
// probe still reports its numbers but never blocks: a spec host legitimately sits below the floor and
// every dispatch spec would otherwise wait on the machine, not on the code under test.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { memoryProbe } from '../supervisor/workers.mjs';
import { allocationSettings } from '../../engine/config.mjs';

export const HOST_RESOURCES_LOW = 'host-resources-low';
export const HOST_RESOURCES_ENV = 'STARCI_HOST_RESOURCES_JSON';
export const DEFAULT_MIN_FREE_DISK_GB = 20;
export const DEFAULT_MIN_FREE_RAM_PCT = 15;

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const numOrNull = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

/** The declared floors from allocation.resources.* (the defaults stand while runtimes.yaml omits them). */
export const resourceThresholds = (settings = null) => {
  const resources = (settings ?? allocationSettings())?.resources ?? {};
  const positive = (v, fallback) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : fallback; };
  return { minFreeDiskGb: positive(resources.minFreeDiskGb, DEFAULT_MIN_FREE_DISK_GB), minFreeRamPct: positive(resources.minFreeRamPct, DEFAULT_MIN_FREE_RAM_PCT) };
};

/** The drive (or mount root) a path resolves on, spelled 'C:' on Windows, '/' on POSIX. */
export const driveOf = (p) => {
  const root = path.parse(path.resolve(String(p))).root;
  return root.replace(/[\\/]+$/, '') || root;
};

const sameDrive = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

/** Free bytes an ordinary user can still write on a statfs result, in GB. */
const freeGbOf = (s) => (num(s?.bavail) * num(s?.bsize)) / 1e9;

/** The verdict over measured drives and RAM: the worst measured drive binds. */
const finishProbe = ({ drives, totalRamBytes, freeRamBytes, freeRamPct, ramKnown, thresholds, override = false }) => {
  const measured = [...drives].filter((d) => d.freeDiskGb != null).sort((a, b) => a.freeDiskGb - b.freeDiskGb);
  const worst = measured[0] ?? null;
  const lowDisk = worst != null && worst.freeDiskGb < thresholds.minFreeDiskGb;
  const lowRam = ramKnown === true && freeRamPct < thresholds.minFreeRamPct;
  return {
    ok: !lowDisk && !lowRam, lowDisk, lowRam,
    drive: worst?.drive ?? null, freeDiskGb: worst?.freeDiskGb ?? null,
    drives, totalRamBytes, freeRamBytes, freeRamPct, thresholds,
    ...(override ? { override: true } : {}),
  };
};

/**
 * The live probe. `statfs(path)` returns {bavail,bsize,...} (fs.statfsSync); `meminfo()` returns
 * {totalRamBytes, freeRamBytes} (memoryProbe). A drive whose statfs fails keeps its entry with `error`
 * and counts as unmeasured — the guard judges only drives it actually read.
 */
export function probeHostResources({ env = process.env, repo = null, settings = null, statfs = (p) => fs.statfsSync(p), meminfo = () => memoryProbe() } = {}) {
  const thresholds = resourceThresholds(settings);
  const tempDir = env?.TEMP || env?.TMP || os.tmpdir();
  const wanted = [{ role: 'temp', drive: driveOf(tempDir), path: tempDir }];
  if (repo) {
    const rd = driveOf(repo);
    if (rd && !wanted.some((w) => sameDrive(w.drive, rd))) wanted.push({ role: 'repo', drive: rd, path: repo });
  }
  const drives = wanted.map((w) => {
    try {
      return { ...w, freeDiskGb: freeGbOf(statfs(w.path)) };
    } catch (error) {
      return { ...w, freeDiskGb: null, error: String(error?.message ?? error) };
    }
  });
  let mem = {};
  try { mem = meminfo() ?? {}; } catch { /* an unreadable memory figure counts as unmeasured */ }
  const totalRamBytes = num(mem.totalRamBytes), freeRamBytes = num(mem.freeRamBytes);
  const freeRamPct = totalRamBytes > 0 ? (freeRamBytes / totalRamBytes) * 100 : 0;
  return finishProbe({ drives, totalRamBytes, freeRamBytes, freeRamPct, ramKnown: totalRamBytes > 0, thresholds });
}

/**
 * The probe shape over override-supplied measurements (the STARCI_HOST_RESOURCES_JSON seam): the JSON
 * names drives and RAM numbers, this function computes the verdicts against the real thresholds.
 */
export function hostResourcesFromOverride(raw, { settings = null } = {}) {
  const thresholds = resourceThresholds(settings);
  const d = raw && typeof raw === 'object' ? raw : {};
  const list = Array.isArray(d.drives) && d.drives.length
    ? d.drives
    : [{ drive: d.drive ?? null, path: d.path ?? null, freeDiskGb: d.freeDiskGb ?? null }];
  const drives = list.map((x) => ({ drive: x?.drive ?? null, path: x?.path ?? null, freeDiskGb: numOrNull(x?.freeDiskGb) }));
  const totalRamBytes = num(d.totalRamBytes), freeRamBytes = num(d.freeRamBytes);
  const freeRamPct = d.freeRamPct != null ? num(d.freeRamPct) : (totalRamBytes > 0 ? (freeRamBytes / totalRamBytes) * 100 : 0);
  const ramKnown = totalRamBytes > 0 || d.freeRamPct != null;
  return finishProbe({ drives, totalRamBytes, freeRamBytes, freeRamPct, ramKnown, thresholds, override: true });
}

/**
 * The probe the dispatch admission path reads: the STARCI_HOST_RESOURCES_JSON override when set, else
 * the live probe — which inside a node --test tree reports but never blocks (see the header).
 */
export function hostResourcesFor({ env = process.env, repo = null, settings = null, statfs, meminfo } = {}) {
  const raw = env?.[HOST_RESOURCES_ENV];
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return hostResourcesFromOverride(JSON.parse(raw), { settings });
    } catch (error) {
      return { ...probeHostResources({ env, repo, settings, statfs, meminfo }), overrideError: String(error?.message ?? error) };
    }
  }
  const probe = probeHostResources({ env, repo, settings, statfs, meminfo });
  if (env?.NODE_TEST_CONTEXT) return { ...probe, ok: true, testContext: true };
  return probe;
}
