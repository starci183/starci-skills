import os from 'node:os';
import { readModuleJson } from '../../engine/runtime-root.mjs';
import { machineLoad, memoryProbe } from './host-resources.mjs';

/** Resolve an explicit file limit or a fresh host budget immediately before the spec process starts. */
export function resolveTestConcurrency(explicit, deps = {}) {
  if (explicit != null) {
    if (!Number.isSafeInteger(explicit) || explicit < 1) throw new RangeError('--concurrency must be a positive integer');
    return { concurrency: explicit, mode: 'explicit' };
  }
  const policy = readModuleJson('modules', 'supervisor', 'test-concurrency.yaml');
  if (!['sampleMs', 'maxFiles', 'logicalThreadsPerFile', 'ramPerFileGiB', 'minimumReserveGiB', 'reserveRamPct']
    .every(key => Number.isFinite(policy[key]) && policy[key] > 0)
    || !Number.isSafeInteger(policy.maxFiles) || policy.reserveRamPct >= 100) {
    throw new Error('Invalid modules/supervisor/test-concurrency.yaml');
  }
  let sample;
  try {
    sample = (deps.hostSample ?? (() => ({ ...machineLoad({ sampleMs: policy.sampleMs }),
      ...memoryProbe(), logicalThreads: os.availableParallelism() })))();
  } catch {
    return { concurrency: 1, mode: 'auto', reason: 'resources-unavailable', sample: null };
  }
  const { logicalThreads, cpuBusy, totalRamBytes, freeRamBytes } = sample ?? {};
  const resources = { logicalThreads, cpuBusy, totalRamBytes, freeRamBytes };
  if (!Object.values(resources).every(Number.isFinite) || !Number.isSafeInteger(logicalThreads) || logicalThreads < 1
    || cpuBusy < 0 || cpuBusy > 1 || totalRamBytes <= 0 || freeRamBytes < 0 || freeRamBytes > totalRamBytes) {
    return { concurrency: 1, mode: 'auto', reason: 'resources-unavailable', sample: resources };
  }
  const reserveRamBytes = Math.max(policy.minimumReserveGiB * 1024 ** 3, totalRamBytes * policy.reserveRamPct / 100);
  const cpuLimit = Math.max(1, Math.floor(logicalThreads * (1 - cpuBusy) / policy.logicalThreadsPerFile));
  const ramLimit = Math.max(1, Math.floor(Math.max(0, freeRamBytes - reserveRamBytes) / (policy.ramPerFileGiB * 1024 ** 3)));
  return { concurrency: Math.min(policy.maxFiles, cpuLimit, ramLimit), mode: 'auto', cpuLimit, ramLimit,
    reserveRamBytes, maxFiles: policy.maxFiles, sample: resources };
}
