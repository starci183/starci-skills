// host-resources.mjs — the host capacity probe `starci kernel dispatch --spawn` reads before launching a worker
// (spec item 3: disk and RAM guards on the existing admission path). A starved host is a typed WAIT
// (reason 'host-resources-low', waiting:true), never a rejection: nothing is spawned, nothing is
// recorded, and every dispatch re-probes so admission recovers on its own once there is room again.
//
//   { ok, lowDisk, lowRam, drive, freeDiskGb, totalRamBytes, freeRamBytes, freeRamPct, drives, thresholds }
//
// Disk is measured on the drive holding the configured temp root (engine/temp-root.mjs tempRoot: STARCI_TEMP_ROOT, then
// config.yaml roots.temp, else the OS temp directory) and on the repo's drive when it differs — `drives`
// reports both and the WORST one binds (drive/freeDiskGb name it). RAM reuses the worker cap's probe
// (memoryProbe below — `workers.mjs cap` reads the same machine) rather than
// a second memory sample. The floors are one set of numbers: the shipped policy modules/models/runtimes.yaml
// `allocation.resources` (minFreeDiskGb, minFreeRamPct) is the only place that carries a default, and the owner's
// config.yaml `resources` (minFreeDiskGb, minFreeDiskPct, minFreeRamPct) overrides it key by key
// (engine/resources-config.mjs hostFloors). A drive is low when its free space is under the larger of minFreeDiskGb and
// minFreeDiskPct of the drive's size. A policy without minFreeDiskGb or minFreeRamPct is an error, not a silent number.
//
// Seams: `statfs` and `meminfo` inject the raw reads in specs; STARCI_HOST_RESOURCES_JSON is the
// probe override a spec (or the watchdog) hands the dispatch CLI — its JSON supplies MEASUREMENTS
// ({drives:[{drive,path,freeDiskGb}], totalRamBytes, freeRamBytes, freeRamPct} or the flat
// {freeDiskGb, freeRamPct} shorthand) and the verdicts are computed against the real thresholds, so an
// override exercises the same boundary math the live probe does. Inside a node --test process tree
// (NODE_TEST_CONTEXT — the same seam engine/db/ledger.mjs reads for its registry) with no override the
// probe still reports its numbers but never blocks: a spec host legitimately sits below the floor and
// every dispatch spec would otherwise wait on the machine, not on the code under test.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sleepSync } from '../lib/sleep-sync.mjs';
import { allocationSettings, loadConfig } from '../../engine/config.mjs';
import { hostFloors } from '../../engine/resources-config.mjs';
import { tempRoot } from '../../engine/temp-root.mjs';
import { isSpecRun } from '../lib/env.mjs';

/**
 * The machine's RAM right now: {totalRamBytes, freeRamBytes, freeMem} — freeMem is the 0..1 fraction
 * machineLoad reports. The memory half of the worker cap's load sample (scripts/supervisor/workers.mjs) and
 * of the dispatch host-resources guard: one probe, not two.
 */
export function memoryProbe({ mem = os } = {}) {
  const totalRamBytes = mem.totalmem(), freeRamBytes = mem.freemem();
  return { totalRamBytes, freeRamBytes, freeMem: totalRamBytes > 0 ? freeRamBytes / totalRamBytes : 0 };
}

/** One machine-load sample: {cpuBusy, freeMem} as fractions; CPU over `sampleMs`. */
export function machineLoad({ sampleMs = 400 } = {}) {
  const snap = () => os.cpus().reduce((a, c) => { const t = c.times; const total = t.user + t.nice + t.sys + t.idle + t.irq; return { idle: a.idle + t.idle, total: a.total + total }; }, { idle: 0, total: 0 });
  const a = snap();
  sleepSync(sampleMs);
  const b = snap();
  const total = b.total - a.total;
  return { cpuBusy: total > 0 ? Math.max(0, Math.min(1, 1 - (b.idle - a.idle) / total)) : 0, freeMem: memoryProbe().freeMem };
}

export const HOST_RESOURCES_LOW = 'host-resources-low';
export const HOST_RESOURCES_ENV = 'STARCI_HOST_RESOURCES_JSON';

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const numOrNull = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

/**
 * The floors in force: {minFreeDiskGb, minFreeDiskPct|null, minFreeRamPct} - the owner's config.yaml `resources` over the
 * shipped allocation.resources. `settings` is the allocation block (default: the shipped policy), `config` the owner
 * config (default: loadConfig()).
 */
export const resourceThresholds = (settings = null, config = undefined) =>
  hostFloors((settings ?? allocationSettings())?.resources, (config === undefined ? loadConfig() : config)?.resources ?? null);

/** The drive (or mount root) a path resolves on, spelled 'C:' on Windows, '/' on POSIX. */
export const driveOf = (p) => {
  const root = path.parse(path.resolve(String(p))).root;
  let withoutTrailingSeparators = root;
  while (withoutTrailingSeparators.endsWith('/') || withoutTrailingSeparators.endsWith('\\')) withoutTrailingSeparators = withoutTrailingSeparators.slice(0, -1);
  return withoutTrailingSeparators || root;
};

const sameDrive = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

/** Free bytes an ordinary user can still write on a statfs result, in GB. */
const freeGbOf = (s) => (num(s?.bavail) * num(s?.bsize)) / 1e9;
/** The size of the drive a statfs result describes, in GB (0 when the result carries no block counts). */
const totalGbOf = (s) => (num(s?.blocks) * num(s?.bsize)) / 1e9;

/** The free space a drive must keep: the larger of minFreeDiskGb and minFreeDiskPct of its size (the percentage needs a known size). */
const requiredGbOf = (drive, thresholds) => {
  const byPct = thresholds.minFreeDiskPct != null && num(drive.totalDiskGb) > 0 ? (num(drive.totalDiskGb) * thresholds.minFreeDiskPct) / 100 : 0;
  return Math.max(thresholds.minFreeDiskGb, byPct);
};

/** The verdict over measured drives and RAM: the worst measured drive binds. */
const finishProbe = ({ drives, totalRamBytes, freeRamBytes, freeRamPct, ramKnown, thresholds, override = false }) => {
  const measured = drives.filter((d) => d.freeDiskGb != null)
    .map((d) => ({ ...d, requiredDiskGb: requiredGbOf(d, thresholds) }))
    .sort((a, b) => (a.freeDiskGb - a.requiredDiskGb) - (b.freeDiskGb - b.requiredDiskGb));
  const worst = measured[0] ?? null;
  const lowDisk = worst != null && worst.freeDiskGb < worst.requiredDiskGb;
  const lowRam = ramKnown === true && freeRamPct < thresholds.minFreeRamPct;
  return {
    ok: !lowDisk && !lowRam, lowDisk, lowRam,
    drive: worst?.drive ?? null, freeDiskGb: worst?.freeDiskGb ?? null, requiredDiskGb: worst?.requiredDiskGb ?? null,
    drives: drives.map((d) => measured.find((m) => m.drive === d.drive && m.path === d.path) ?? d), totalRamBytes, freeRamBytes, freeRamPct, thresholds,
    ...(override ? { override: true } : {}),
  };
};

/** statfs of `target`, or of its nearest existing ancestor (the same drive) while the directory itself is not made yet. */
const statfsNearest = (statfs, target) => {
  let dir = target;
  for (;;) {
    try { return statfs(dir); } catch (error) {
      const parent = path.dirname(dir);
      if (error?.code !== 'ENOENT' || parent === dir) throw error;
      dir = parent;
    }
  }
};

/**
 * The live probe. `statfs(path)` returns {bavail,bsize,...} (fs.statfsSync); `meminfo()` returns
 * {totalRamBytes, freeRamBytes} (memoryProbe). A drive whose statfs fails keeps its entry with `error`
 * and counts as unmeasured — the guard judges only drives it actually read.
 */
export function probeHostResources({ env = process.env, repo = null, settings = null, config = undefined, statfs = (p) => fs.statfsSync(p), meminfo = () => memoryProbe() } = {}) {
  const thresholds = resourceThresholds(settings, config);
  const tempDir = tempRoot({ env, config });
  const wanted = [{ role: 'temp', drive: driveOf(tempDir), path: tempDir }];
  if (repo) {
    const rd = driveOf(repo);
    if (rd && !wanted.some((w) => sameDrive(w.drive, rd))) wanted.push({ role: 'repo', drive: rd, path: repo });
  }
  const drives = wanted.map((w) => {
    try {
      const stat = statfsNearest(statfs, w.path);
      return { ...w, freeDiskGb: freeGbOf(stat), totalDiskGb: totalGbOf(stat) };
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
export function hostResourcesFromOverride(raw, { settings = null, config = undefined } = {}) {
  const thresholds = resourceThresholds(settings, config);
  const d = raw && typeof raw === 'object' ? raw : {};
  const list = Array.isArray(d.drives) && d.drives.length
    ? d.drives
    : [{ drive: d.drive ?? null, path: d.path ?? null, freeDiskGb: d.freeDiskGb ?? null, totalDiskGb: d.totalDiskGb ?? null }];
  const drives = list.map((x) => ({ drive: x?.drive ?? null, path: x?.path ?? null, freeDiskGb: numOrNull(x?.freeDiskGb), totalDiskGb: numOrNull(x?.totalDiskGb) }));
  const totalRamBytes = num(d.totalRamBytes), freeRamBytes = num(d.freeRamBytes);
  let freeRamPct;
  if (d.freeRamPct != null) freeRamPct = num(d.freeRamPct);
  else if (totalRamBytes > 0) freeRamPct = (freeRamBytes / totalRamBytes) * 100;
  else freeRamPct = 0;
  const ramKnown = totalRamBytes > 0 || d.freeRamPct != null;
  return finishProbe({ drives, totalRamBytes, freeRamBytes, freeRamPct, ramKnown, thresholds, override: true });
}

/**
 * The probe the dispatch admission path reads: the STARCI_HOST_RESOURCES_JSON override when set, else
 * the live probe — which inside a node --test tree reports but never blocks (see the header).
 */
export function hostResourcesFor({ env = process.env, repo = null, settings = null, config = undefined, statfs, meminfo } = {}) {
  const raw = env?.[HOST_RESOURCES_ENV];
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return hostResourcesFromOverride(JSON.parse(raw), { settings, config });
    } catch (error) {
      return { ...probeHostResources({ env, repo, settings, config, statfs, meminfo }), overrideError: String(error?.message ?? error) };
    }
  }
  const probe = probeHostResources({ env, repo, settings, config, statfs, meminfo });
  if (isSpecRun(env ?? {})) return { ...probe, ok: true, testContext: true };
  return probe;
}
