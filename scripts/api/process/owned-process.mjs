// Process-object identity and bounded termination; callers supply custody captured at their own launch.
import { spawnSync } from 'node:child_process';
import { PROCESS_ENV_NATIVE } from './lib.mjs';
import { OWNED_PROCESS_SCHEMA, validProcessIdentity as validIdentity } from '../../lib/process-identity.mjs';
import { allocationMs } from '../../../engine/config.mjs';

const NATIVE = `
public static class StarciOwnedProcess {
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint access, bool inherit, int pid);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetProcessTimes(IntPtr h, out long created, out long exited, out long kernel, out long user);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool QueryFullProcessImageName(IntPtr h, uint flags, StringBuilder exe, ref int size);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateProcess(IntPtr h, uint code);
  [DllImport("kernel32.dll", SetLastError=true)] static extern uint WaitForSingleObject(IntPtr h, uint ms);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  public static object[] Call(int pid, bool stop, string birth, string image, string ownershipKey, string ownershipValue, uint waitMs) {
    var h = OpenProcess(0x00101000u | (stop ? 1u : 0u) | (ownershipKey != null ? 0x0410u : 0u), false, pid);
    if (h == IntPtr.Zero) return new object[] {false, "unknown", "process-open-unverified", null, null, Marshal.GetLastWin32Error()};
    try {
      long created, exited, kernel, user; var exe = new StringBuilder(32768); int size = exe.Capacity;
      if (!GetProcessTimes(h, out created, out exited, out kernel, out user) || !QueryFullProcessImageName(h, 0, exe, ref size))
        return new object[] {false, "unknown", "process-identity-unreadable", null, null, Marshal.GetLastWin32Error()};
      var actualBirth = created.ToString(System.Globalization.CultureInfo.InvariantCulture); var actualImage = exe.ToString();
      if (stop && (actualBirth != birth || !String.Equals(actualImage, image, StringComparison.OrdinalIgnoreCase)))
        return new object[] {false, "refused", "process-identity-conflict", actualBirth, actualImage, 0};
      if (!stop && ownershipKey != null) {
        var environment = StarciProcessEnv.EnvHandle(h);
        if (environment == null || !environment.ContainsKey(ownershipKey) || environment[ownershipKey] != ownershipValue)
          return new object[] {false, "unknown", "process-launch-custody-unverified", actualBirth, actualImage, 0};
      }
      var first = WaitForSingleObject(h, 0);
      if (!stop) return first == 258u ? new object[] {true, "captured", "process-handle-live", actualBirth, actualImage, 0}
        : new object[] {false, "unknown", "process-not-live-at-capture", actualBirth, actualImage, 0};
      if (first == 0u) return new object[] {true, "gone", "process-handle-signaled", actualBirth, actualImage, 0};
      if (first != 258u || !TerminateProcess(h, 1))
        return new object[] {false, "unknown", "process-termination-unverified", actualBirth, actualImage, Marshal.GetLastWin32Error()};
      return WaitForSingleObject(h, waitMs) == 0u
        ? new object[] {true, "stopped", "process-handle-signaled", actualBirth, actualImage, 0}
        : new object[] {false, "unknown", "process-closure-unverified", actualBirth, actualImage, 0};
    } finally { CloseHandle(h); }
  }
}`;
const quote = (value) => value == null ? '$null' : `'${String(value).replaceAll("'", "''")}'`;

const refusalReason = (pid, identity, ownership, waitMs) => {
  if (!Number.isInteger(pid) || pid <= 0 || identity && !validIdentity(identity)
      || ownership && (typeof ownership.key !== 'string' || !ownership.key || typeof ownership.value !== 'string' || !ownership.value))
    return { reason: 'process-custody-required' };
  if (!Number.isInteger(waitMs) || waitMs <= 0 || waitMs > 60000) return { reason: 'process-wait-invalid' };
  return null;
};

const receiptIncomplete = (data, pid, identity, actual) => {
  if (data?.schema !== OWNED_PROCESS_SCHEMA || data.pid !== pid || typeof data.ok !== 'boolean'
      || !['unknown', 'refused', 'captured', 'stopped', 'gone'].includes(data.outcome) || typeof data.proof !== 'string')
    return true;
  if (!data.ok) return false;
  if (!validIdentity(actual)) return true;
  if (identity && (actual.birth !== identity.birth || actual.exe.toLowerCase() !== identity.exe.toLowerCase())) return true;
  if (data.proof !== (identity ? 'process-handle-signaled' : 'process-handle-live')) return true;
  return !(identity ? ['gone', 'stopped'] : ['captured']).includes(data.outcome);
};

/**
 * Capture a live process, or stop the exact captured identity on one verified native handle.
 * Only Windows is qualified; custody, platform, child completion or receipt failures remain refused or unknown.
 * The capture and stop call files constrain their modes; this engine preserves the supplied identity and raw outcome.
 */
export function ownedProcess(pid, { identity = null, ownership = null, waitMs = allocationMs('workerClose.stopVerifyMs'), run = spawnSync, platform = process.platform } = {}) {
  const base = { schema: OWNED_PROCESS_SCHEMA, pid, ok: false, outcome: 'unknown', identity: identity ?? null };
  if (platform !== 'win32') return { ...base, reason: 'process-platform-unverified' };
  const refused = refusalReason(pid, identity, ownership, waitMs);
  if (refused) return { ...base, outcome: 'refused', reason: refused.reason };
  const script = [`Add-Type -TypeDefinition @'\n${PROCESS_ENV_NATIVE}\n${NATIVE}\n'@ -Language CSharp`,
    `$r = [StarciOwnedProcess]::Call(${pid}, $${identity ? 'true' : 'false'}, ${quote(identity?.birth)}, ${quote(identity?.exe)}, ${quote(ownership?.key)}, ${quote(ownership?.value)}, ${waitMs})`,
    `@{ schema = '${OWNED_PROCESS_SCHEMA}'; pid = ${pid}; ok = $r[0]; outcome = $r[1]; proof = $r[2]; birth = $r[3]; exe = $r[4]; nativeError = $r[5] } | ConvertTo-Json -Compress`].join('\n');
  let result;
  try { result = run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script],
    { encoding: 'utf8', windowsHide: true, timeout: waitMs + 15000, maxBuffer: 1024 * 1024 }); }
  catch (error) { return { ...base, reason: 'process-call-incomplete', error: String(error?.message ?? error) }; }
  if (result?.status !== 0 || result.error || result.signal)
    return { ...base, reason: 'process-call-incomplete', status: result?.status ?? null, signal: result?.signal ?? null, error: result?.error?.message ?? null };
  let data;
  try { data = JSON.parse(String(result.stdout ?? '').trim()); } catch { return { ...base, reason: 'process-receipt-incomplete' }; }
  const actual = { pid, birth: data?.birth, exe: data?.exe };
  if (receiptIncomplete(data, pid, identity, actual))
    return { ...base, reason: 'process-receipt-incomplete' };
  return { schema: OWNED_PROCESS_SCHEMA, pid, ok: data.ok, outcome: data.outcome, proof: data.proof,
    identity: identity ?? (validIdentity(actual) ? actual : null), nativeError: data.nativeError ?? null,
    ...(identity && validIdentity(actual) && (actual.birth !== identity.birth || actual.exe.toLowerCase() !== identity.exe.toLowerCase()) ? { observedIdentity: actual } : {}),
    ...(data.ok ? {} : { reason: data.proof }) };
}
