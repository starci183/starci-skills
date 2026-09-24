// scripts/api/quota/devin.mjs — devin viability + seat quota probe. The numbers
// come from the same Windsurf seat API devin.exe itself calls:
//   POST https://server.codeium.com/exa.seat_management_pb.SeatManagementService/GetUserStatus
//   Connect-JSON: content-type application/json, connect-protocol-version: 1
//   body {metadata:{apiKey, ideName:"devin-cli", ideVersion, extensionName, extensionVersion, locale}}
// apiKey is `windsurf_api_key` in %APPDATA%/devin/credentials.toml — read into
// memory only: never logged, printed, persisted, or embedded in an error
// string. The key travels to the child process in its stdin payload, never on
// argv or in env, and is scrubbed out of anything the result reports.
//
// The probe stays SYNCHRONOUS (workers.mjs and route-model.mjs call it without
// awaiting), so the HTTP call runs in a `node -e` child under spawnSync.
// Endpoint and credentials file are injectable for the spec's fake server;
// STARCI_DEVIN_SEAT_ENDPOINT overrides the endpoint in production too.
//
// Response userStatus.planStatus carries dailyQuotaRemainingPercent,
// weeklyQuotaRemainingPercent, dailyQuotaResetAtUnix, weeklyQuotaResetAtUnix,
// billingStrategy, planEnd, overageBalanceMicros.
//   usedPercent = 100 - min(daily, weekly remaining)
//   remaining <= 10%                     -> 'limited'
//   remaining <= 0% and no overage       -> 'dead'
//   remaining <= 0% with overage balance -> 'limited' (calls still bill through)
//   any API or credential failure        -> 'unknown' (NEVER dead)
// Results are cached cacheMs (default 5 min) so a route storm does not hammer
// the seat API; cacheMs: 0 disables.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const DEFAULT_ENDPOINT = 'https://server.codeium.com/exa.seat_management_pb.SeatManagementService/GetUserStatus';
const DEFAULT_CACHE_MS = 5 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 15000;

// The child's one job: read {endpoint, payload, timeoutMs} on stdin, POST the
// Connect-JSON call, print {status, body} (or {status:0, error}) as JSON on
// stdout. It never echoes the request, so the apiKey cannot reach our logs.
const CHILD = `
let raw = '';
process.stdin.on('data', (c) => { raw += c; }).on('end', async () => {
  try {
    const { endpoint, payload, timeoutMs } = JSON.parse(raw);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'connect-protocol-version': '1' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    process.stdout.write(JSON.stringify({ status: res.status, body: text.slice(0, 65536) }));
  } catch (error) {
    process.stdout.write(JSON.stringify({ status: 0, error: String((error && error.message) || error) }));
  }
});
`;

/** Where the Devin desktop app keeps its CLI credentials. */
export const devinCredentialsFile = (env = process.env) =>
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
const asNumber = (v) => { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const iso = (unix) => { const n = asNumber(unix); return n == null ? null : new Date(n * 1000).toISOString(); };

/** The probe result for one planStatus body. Pure; exported for the spec. */
export function planToResult(plan) {
  const daily = asNumber(plan?.dailyQuotaRemainingPercent);
  const weekly = asNumber(plan?.weeklyQuotaRemainingPercent);
  if (daily == null && weekly == null) {
    return { state: 'unknown', usedPercent: null, detail: 'GetUserStatus planStatus carried no quota percentages' };
  }
  const remaining = Math.min(daily ?? 100, weekly ?? 100);
  const usedPercent = clampPct(Math.round((100 - remaining) * 10) / 10);
  const resets = [iso(plan?.dailyQuotaResetAtUnix), iso(plan?.weeklyQuotaResetAtUnix)].filter(Boolean).sort();
  const resetsAt = resets[0] ?? null;
  const overage = asNumber(plan?.overageBalanceMicros) > 0;
  const parts = [
    `devin seat quota ${usedPercent}% used (${remaining}% remaining)`,
    daily != null ? `daily ${daily}% left${iso(plan?.dailyQuotaResetAtUnix) ? `, resets ${iso(plan.dailyQuotaResetAtUnix)}` : ''}` : null,
    weekly != null ? `weekly ${weekly}% left${iso(plan?.weeklyQuotaResetAtUnix) ? `, resets ${iso(plan.weeklyQuotaResetAtUnix)}` : ''}` : null,
    plan?.billingStrategy ? `plan ${plan.billingStrategy}` : null,
    overage ? 'overage balance present' : null,
  ].filter(Boolean).join(' — ');
  if (remaining <= 0 && !overage) return { state: 'dead', usedPercent, resetsAt, detail: `${parts} — quota exhausted` };
  if (remaining <= 10) {
    return { state: 'limited', usedPercent, resetsAt,
      detail: `${parts}${remaining <= 0 ? ' — exhausted; overage balance still bills' : ' — under 10% remaining'}` };
  }
  return { state: 'ok', usedPercent, resetsAt, detail: parts };
}

const cache = new Map();

/**
 * The pinned probe. Options (all injectable for specs):
 *   endpoint        seat API URL (default DEFAULT_ENDPOINT; env STARCI_DEVIN_SEAT_ENDPOINT)
 *   credentialsFile credentials.toml path (default %APPDATA%/devin/credentials.toml)
 *   apiKey          direct key (specs); otherwise read from credentialsFile
 *   metadata        extra/override fields of the Connect-JSON metadata
 *   timeoutMs       API timeout (default 15 s); the child is hard-killed 8 s later
 *   cacheMs         result cache TTL (default 5 min; 0 disables)
 *   env             environment for APPDATA/STARCI_DEVIN_SEAT_ENDPOINT (default process.env)
 */
export function probe({ endpoint, credentialsFile, apiKey = null, metadata = {}, timeoutMs = DEFAULT_TIMEOUT_MS, cacheMs = DEFAULT_CACHE_MS, env = process.env } = {}) {
  const url = endpoint ?? env.STARCI_DEVIN_SEAT_ENDPOINT ?? DEFAULT_ENDPOINT;
  const credFile = credentialsFile ?? devinCredentialsFile(env);
  const key = apiKey ?? readWindsurfApiKey(credFile);
  const scrub = (s) => (key ? String(s ?? '').split(key).join('[redacted]') : String(s ?? ''));
  if (!key) {
    return { state: 'unknown', usedPercent: null, detail: `no windsurf_api_key in ${credFile}` };
  }
  const cacheKey = `${url}|${credFile}`;
  const hit = cache.get(cacheKey);
  if (cacheMs > 0 && hit && Date.now() - hit.at < cacheMs) return hit.result;
  const payload = {
    metadata: {
      apiKey: key,
      ideName: 'devin-cli',
      ideVersion: metadata.ideVersion ?? 'unknown',
      extensionName: metadata.extensionName ?? 'devin',
      extensionVersion: metadata.extensionVersion ?? 'unknown',
      locale: metadata.locale ?? 'en-US',
      ...metadata,
    },
  };
  let r;
  try {
    r = spawnSync(process.execPath, ['-e', CHILD], {
      input: JSON.stringify({ endpoint: url, payload, timeoutMs }),
      encoding: 'utf8', timeout: timeoutMs + 8000, maxBuffer: 1 << 20, windowsHide: true,
    });
  } catch (error) {
    return { state: 'unknown', usedPercent: null, detail: `seat API spawn failed: ${scrub(error?.message ?? error)}` };
  }
  const finish = (result) => { if (cacheMs > 0) cache.set(cacheKey, { at: Date.now(), result }); return result; };
  if (r.error || r.status !== 0) {
    return finish({ state: 'unknown', usedPercent: null,
      detail: `seat API child failed${r.error?.message ? ` (${scrub(r.error.message)})` : ''}${r.stderr ? `: ${scrub(r.stderr).slice(0, 200)}` : ''}` });
  }
  let out;
  try { out = JSON.parse(r.stdout); } catch {
    return finish({ state: 'unknown', usedPercent: null, detail: 'seat API child returned unparsable output' });
  }
  if (!Number.isInteger(out?.status) || out.status === 0) {
    return finish({ state: 'unknown', usedPercent: null, detail: `seat API unreachable: ${scrub(out?.error ?? 'network error')}` });
  }
  if (out.status < 200 || out.status >= 300) {
    return finish({ state: 'unknown', usedPercent: null, detail: `seat API answered HTTP ${out.status}` });
  }
  let body;
  try { body = JSON.parse(out.body); } catch {
    return finish({ state: 'unknown', usedPercent: null, detail: 'seat API returned a non-JSON body' });
  }
  const plan = body?.userStatus?.planStatus;
  if (!plan || typeof plan !== 'object') {
    return finish({ state: 'unknown', usedPercent: null, detail: 'GetUserStatus carried no userStatus.planStatus' });
  }
  return finish(planToResult(plan));
}
