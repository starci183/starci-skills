// scripts/api/quota/qwen.mjs — qwen viability probe and plan reset instant. NO network
// and no metering.
//
// Owner ruling 2026-09-24: Qwen (DeepSeek V4.1 Flash on the Token Plan) is the BASE
// pool every task uses; it is cheap, so it is not metered. It is blocked only
// REACTIVELY, when a launch or a worker screen proves the plan quota exhausted:
// the kernel opens the qwen provider-health circuit (failureKind quota,
// scripts/kernel/api.mjs) and routing skips the pool until a real 1-token
// completion passes again (scripts/agent/credential-probe.mjs probeProviderQuota).
//
// What stays here is what that circuit and this probe need:
//   probe()       credential presence only: 'dead' with no key, else 'ok'
//                 (usedPercent null - there is no local meter)
//   qwenPlan()    the config.yaml quota.qwen block normalized; the validator
//                 still accepts every documented field, only resetAt is read
//   planWindow()  the plan window around `now`, rolled forward a month at a time
//   nextResetAt() the next plan reset instant (ms) or null without config: a quota
//                 circuit expires at it, and the recovery probe runs right after it
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { configRoot, inspectOwnerConfig } from '../../../engine/config.mjs';

const ENV_KEYS = ['BAILIAN_TOKEN_PLAN_API_KEY', 'DASHSCOPE_API_KEY', 'OPENAI_API_KEY'];
const qwenHomeDefault = () => path.join(os.homedir(), '.qwen');
const qwenEnvFile = (home) => path.join(home, '.env');

/**
 * The normalized quota.qwen block of an owner config, or null when absent or
 * without a valid resetAt: {resetAt(ms)}.
 */
export function qwenPlan(config) {
  const q = config?.quota?.qwen;
  if (!q || typeof q !== 'object') return null;
  const resetAt = Date.parse(q.resetAt ?? '');
  if (!Number.isFinite(resetAt)) return null;
  return { resetAt };
}

/**
 * The plan window containing `now`: [resetAt - 1 month, resetAt) with resetAt
 * rolled forward a month at a time while it lies in the past.
 */
export function planWindow(resetAt, now = Date.now()) {
  let end = new Date(resetAt);
  while (end.getTime() <= now) { const next = new Date(end); next.setMonth(next.getMonth() + 1); end = next; }
  const start = new Date(end);
  start.setMonth(start.getMonth() - 1);
  return { start: start.getTime(), end: end.getTime() };
}

/** The owner config read tolerantly: the raw parse even while a key is not yet in the schema. */
const ownerConfigRaw = (root) => { try { return inspectOwnerConfig(root).config; } catch { return null; } };

/**
 * The next plan reset instant (ms) after `now`, from config.yaml quota.qwen.resetAt,
 * or null when no reset is configured.
 */
export function nextResetAt({ config = undefined, root = configRoot, now = Date.now() } = {}) {
  const plan = qwenPlan(config === undefined ? ownerConfigRaw(root) : config);
  return plan ? planWindow(plan.resetAt, now).end : null;
}

/**
 * The pinned probe: credential presence only. Injectable for specs: env
 * (credential vars), home (~/.qwen), config, root, now.
 */
export function probe({ env = process.env, home = qwenHomeDefault(), config = undefined, root = configRoot, now = Date.now() } = {}) {
  const present = ENV_KEYS.filter((k) => typeof env[k] === 'string' && env[k].trim());
  let credDetail = null;
  if (present.length) {
    credDetail = `credential env present: ${present.join(', ')}`;
  } else {
    try {
      const text = fs.readFileSync(qwenEnvFile(home), 'utf8');
      const fileKeys = ENV_KEYS.filter((k) => new RegExp(`^${k}=`, 'm').test(text));
      if (fileKeys.length) credDetail = `credential in ${qwenEnvFile(home)}: ${fileKeys.join(', ')}`;
    } catch { /* no env file */ }
  }
  if (!credDetail) {
    return { state: 'dead', usedPercent: null, detail: `no qwen credential env (${ENV_KEYS.join(', ')}) and no ${qwenEnvFile(home)} entry` };
  }
  let reset = null;
  try { reset = nextResetAt({ config, root, now }); } catch { reset = null; }
  return {
    state: 'ok', usedPercent: null, resetsAt: reset ? new Date(reset).toISOString() : null,
    detail: `${credDetail}; base pool, not metered - blocked only by an open quota circuit`,
  };
}
