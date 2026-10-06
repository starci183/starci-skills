// scripts/agent/quota/devin.mjs — devin viability + seat quota probe. The numbers
// come from the same Windsurf seat API devin.exe itself calls:
//   POST https://server.codeium.com/exa.seat_management_pb.SeatManagementService/GetUserStatus
//   Connect-JSON: content-type application/json, connect-protocol-version: 1
//   body {metadata:{apiKey, ideName:"devin-cli", ideVersion, extensionName:"devin-cli", extensionVersion, locale}}
// The versions must be version strings: live (2026-09-24) the API answers HTTP
// 500 for extensionVersion "unknown" and 400 when it is absent; a semver such
// as the CLI's own ("devin 3000.10.27") answers 200. devin.exe sends
// application/proto, but the Connect-JSON form of the same message is accepted.
// apiKey is `windsurf_api_key` in %APPDATA%/devin/credentials.toml — read into
// memory only: never logged, printed, persisted, or embedded in an error
// string. The key travels to the child process in its stdin payload, never on
// argv or in env, and is scrubbed out of anything the result reports.
//
// The probe stays SYNCHRONOUS (workers.mjs and route-model.mjs call it without
// awaiting), so the HTTP call (scripts/api/windsurf/seat-quota.mjs) runs as a node child under spawnSync.
// Endpoint and credentials file are injectable for the spec's fake server;
// STARCI_DEVIN_SEAT_ENDPOINT overrides the endpoint too. Any endpoint other than
// DEFAULT_ENDPOINT must be a loopback http(s) URL, so neither the environment
// nor a caller can redirect the key to a foreign server.
//
// Response userStatus.planStatus carries dailyQuotaRemainingPercent,
// weeklyQuotaRemainingPercent, dailyQuotaResetAtUnix, weeklyQuotaResetAtUnix,
// billingStrategy, planEnd, overageBalanceMicros.
//   usedPercent = 100 - min(daily, weekly remaining)
//   every observed window is normalized through allocation.admission
//   an exhausted window is hard-ineligible
//   overage balance is descriptive; it grants no hard-limit bypass
//   any API or credential failure remains unknown and blocks normal admission
// Raw provider observations are cached for cacheMs, bound to the credential/request bytes.
// Each caller applies its current account/policy while preserving the original observation time.
import { runNode } from '../../api/node/run-node.mjs';
import { sha256 } from '../../../engine/digest.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { allocationSettings } from '../../../engine/config.mjs';
import { normalizeQuotaSnapshot } from './snapshot.mjs';

const DEFAULT_ENDPOINT = 'https://server.codeium.com/exa.seat_management_pb.SeatManagementService/GetUserStatus';
const DEFAULT_CACHE_MS = 5 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 15000;
// The devin CLI release the request shape was verified against; sent as
// ideVersion/extensionVersion unless the caller passes another version string.
const DEVIN_CLI_VERSION = '3000.10.27';
const VERSION_RE = /^\d+\.\d+\.\d+/;
const version = (v) => (typeof v === 'string' && VERSION_RE.test(v) ? v : DEVIN_CLI_VERSION);

/** True for DEFAULT_ENDPOINT or an http(s) URL on localhost / 127.0.0.0/8 / [::1]. */
function allowedEndpoint(url) {
  if (url === DEFAULT_ENDPOINT) return true;
  let u;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  const h = u.hostname;
  return h === 'localhost' || h === '[::1]' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h);
}

// The child is scripts/api/windsurf/seat-quota.mjs: it reads {endpoint, payload, timeoutMs} on stdin and prints
// {status, body} (or {status:0, error}) as JSON on stdout. It never echoes the request, so the apiKey cannot reach our logs.
const SEAT_QUOTA_FILE = fileURLToPath(new URL('../../api/windsurf/seat-quota.mjs', import.meta.url));

/** Where the Devin desktop app keeps its CLI credentials. */
const devinCredentialsFile = (env = process.env) =>
  path.join(env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'devin', 'credentials.toml');

/**
 * `windsurf_api_key` from a credentials.toml, or null. TOML string or bare
 * value; anything else in the file is ignored. The value is returned, never
 * printed.
 */
export function readWindsurfApiKey(file = devinCredentialsFile()) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return null; }
  const m = /^\s*windsurf_api_key\s*=\s*("([^"]*)"|'([^']*)'|[^\s#]+)\s*$/m.exec(text);
  const key = (m?.[2] ?? m?.[3] ?? m?.[1] ?? '').trim();
  return key || null;
}

const clampPct = (n) => Math.min(100, Math.max(0, n));
const asNumber = (v) => { if (v === null || v === undefined || v === '') { return null; } const n = Number(v); return Number.isFinite(n) ? n : null; };
const iso = (unix) => { const n = asNumber(unix); return n == null ? null : new Date(n * 1000).toISOString(); };

/** The probe result for one planStatus body. Pure; exported for the spec. */
export function planToResult(plan, { policy = allocationSettings()?.admission, now = Date.now(), observedAt = now, account = 'default' } = {}) {
  const daily = asNumber(plan?.dailyQuotaRemainingPercent);
  const weekly = asNumber(plan?.weeklyQuotaRemainingPercent);
  if (daily == null && weekly == null) {
    return normalizeQuotaSnapshot({ provider: 'devin', account, auth: plan && typeof plan === 'object' && !Array.isArray(plan) ? 'ok' : 'unknown',
      observedAt, windows: [], detail: 'GetUserStatus planStatus carried no quota percentages' }, { policy, now });
  }
  const remaining = Math.min(daily ?? 100, weekly ?? 100);
  const usedPercent = clampPct(Math.round((100 - remaining) * 10) / 10);
  const overage = asNumber(plan?.overageBalanceMicros) > 0;
  const windowPart = (label, resetsIso) => `${label}% left` + (resetsIso ? `, resets ${resetsIso}` : '');
  const parts = [
    `devin seat quota ${usedPercent}% used (${remaining}% remaining)`,
    daily != null ? windowPart(`daily ${daily}`, iso(plan?.dailyQuotaResetAtUnix)) : null,
    weekly != null ? windowPart(`weekly ${weekly}`, iso(plan?.weeklyQuotaResetAtUnix)) : null,
    plan?.billingStrategy ? `plan ${plan.billingStrategy}` : null,
    overage ? 'overage balance present' : null,
  ].filter(Boolean).join(' — ');
  return normalizeQuotaSnapshot({ provider: 'devin', account, auth: 'ok', observedAt, detail: parts,
    windows: [daily != null ? { id: 'daily', usedPercent: 100 - daily, resetsAt: iso(plan?.dailyQuotaResetAtUnix), observedAt } : null,
      weekly != null ? { id: 'weekly', usedPercent: 100 - weekly, resetsAt: iso(plan?.weeklyQuotaResetAtUnix), observedAt } : null].filter(Boolean) }, { policy, now });
}

const cache = new Map();

// The seat-quota child call: {ok:true, body} on an HTTP 2xx JSON body; else {ok:false, result} with the unknown state.
const seatApiCall = (url, payload, timeoutMs, scrub) => {
  const unknown = (detail) => ({ ok: false, result: { state: 'unknown', usedPercent: null, detail } });
  let r;
  try {
    r = runNode([SEAT_QUOTA_FILE], {
      input: JSON.stringify({ endpoint: url, payload, timeoutMs }),
      encoding: 'utf8', timeout: timeoutMs + 8000, maxBuffer: 1 << 20, windowsHide: true,
    });
  } catch (error) {
    return unknown(`seat API spawn failed: ${scrub(error?.message ?? error)}`);
  }
  if (r.error || r.status !== 0) {
    return unknown(`seat API child failed` + (r.error?.message ? ` (${scrub(r.error.message)})` : '') + (r.stderr ? `: ${scrub(r.stderr).slice(0, 200)}` : ''));
  }
  let out;
  try { out = JSON.parse(r.stdout); } catch {
    return unknown('seat API child returned unparsable output');
  }
  if (!Number.isInteger(out?.status) || out.status === 0) {
    return unknown(`seat API unreachable: ${scrub(out?.error ?? 'network error')}`);
  }
  if (out.status < 200 || out.status >= 300) {
    return unknown(`seat API answered HTTP ${out.status}`);
  }
  let body;
  try { body = JSON.parse(out.body); } catch {
    return unknown('seat API returned a non-JSON body');
  }
  return { ok: true, body };
};

/**
 * The pinned probe. Options (all injectable for specs):
 *   endpoint        seat API URL (default DEFAULT_ENDPOINT; env STARCI_DEVIN_SEAT_ENDPOINT); loopback only otherwise
 *   credentialsFile credentials.toml path (default %APPDATA%/devin/credentials.toml)
 *   apiKey          direct key (specs); otherwise read from credentialsFile
 *   metadata        extra/override fields of the Connect-JSON metadata (non-version versions are replaced)
 *   timeoutMs       API timeout (default 15 s); the child is hard-killed 8 s later
 *   cacheMs         raw observation cache TTL (default 5 min; 0 disables; policy/age are rejudged)
 *   env             environment for APPDATA/STARCI_DEVIN_SEAT_ENDPOINT (default process.env)
 */
export function probe({ endpoint, credentialsFile, apiKey = null, metadata = {}, timeoutMs = DEFAULT_TIMEOUT_MS, cacheMs = DEFAULT_CACHE_MS, env = process.env, policy, now, account } = {}) {
  const url = endpoint ?? env.STARCI_DEVIN_SEAT_ENDPOINT ?? DEFAULT_ENDPOINT;
  if (!allowedEndpoint(url)) {
    return { state: 'unknown', usedPercent: null, detail: 'seat API endpoint override refused: only a loopback http(s) URL may replace the default' };
  }
  const credFile = credentialsFile ?? devinCredentialsFile(env);
  const key = apiKey ?? readWindsurfApiKey(credFile);
  const scrub = (s) => (key ? String(s ?? '').split(key).join('[redacted]') : String(s ?? ''));
  if (!key) {
    return { state: 'unknown', usedPercent: null, detail: `no windsurf_api_key in ${credFile}` };
  }
  const payload = {
    metadata: {
      ideName: 'devin-cli',
      extensionName: 'devin-cli',
      locale: 'en-US',
      ...metadata,
      apiKey: key,
      ideVersion: version(metadata.ideVersion),
      extensionVersion: version(metadata.extensionVersion),
    },
  };
  const clock = () => typeof now === 'function' ? now() : now ?? Date.now();
  // The request fingerprint stays private; changing credentials or metadata cannot reuse another observation.
  const cacheKey = `${url}|${credFile}|${sha256(JSON.stringify(payload))}`;
  const hit = cache.get(cacheKey);
  if (cacheMs > 0 && hit && Date.now() - hit.at < cacheMs)
    return planToResult(hit.plan, { policy, now: clock(), observedAt: hit.observedAt, account });
  const child = seatApiCall(url, payload, timeoutMs, scrub);
  if (!child.ok) return child.result;
  const { body } = child;
  const plan = body?.userStatus?.planStatus;
  if (!plan || typeof plan !== 'object') {
    return { state: 'unknown', usedPercent: null, detail: 'GetUserStatus carried no userStatus.planStatus' };
  }
  const observedAt = clock();
  if (cacheMs > 0) cache.set(cacheKey, { at: Date.now(), observedAt, plan });
  return planToResult(plan, { policy, now: observedAt, account });
}
