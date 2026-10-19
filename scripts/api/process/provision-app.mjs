import path from 'node:path';
import { runProgram } from './run-program.mjs';
import { appProvisionEntry } from './app-provision-entry.mjs';
import { appProvisionEnv, isAppWorkspaceId } from '../../lib/provision-workspace-contract.mjs';

const RECEIPT_PREFIX = 'STARCI_WORKSPACE_RECEIPT=';
const ACTIONS = new Set(['ensure', 'role', 'verify']);

const held = code => ({ outcome: 'unknown', code, writeAck: false, publicReadback: false, consumerVerified: false });

function receiptOf(stdout, action) {
  const lines = String(stdout ?? '').split(/\r?\n/).filter(line => line.startsWith(RECEIPT_PREFIX));
  if (lines.length !== 1) return null;
  try {
    const value = JSON.parse(lines[0].slice(RECEIPT_PREFIX.length));
    if (value?.schema !== 'starci/app-workspace-access@1' || value.ok !== true || value.action !== action
      || !isAppWorkspaceId(value.workspaceId) || value.publicReadback !== true) return null;
    if (!['existing-session', 'password-session'].includes(value.authentication)
      || value.sessionCleanup !== (value.authentication === 'password-session' ? 'acknowledged' : 'not-created')) return null;
    return { outcome: action === 'verify' ? 'verified' : 'applied', code: 'APP_ACCESS_PUBLIC_READBACK', writeAck: action !== 'verify',
      publicReadback: true, consumerVerified: false, resourceId: value.workspaceId,
      proof: { credentialAccepted: true, authentication: value.authentication, sessionCleanup: value.sessionCleanup } };
  } catch { return null; }
}

/**
 * Runs one fixed workspace action without a shell. Private input stays in the child environment;
 * only the closed receipt is returned. Timeout, nonzero exit and malformed output remain unknown,
 * because the child may already have completed part of its remote or database effects.
 */
export function provisionApp({ repoRoot, action, entrySha256, publicEnv, privateEnv, input, parentEnv, timeoutMs }, { run = runProgram } = {}) {
  if (!ACTIONS.has(action) || !Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new Error('APP_ACCESS_ACTION_REFUSED');
  const entry = appProvisionEntry(repoRoot, entrySha256);
  const env = appProvisionEnv(publicEnv, privateEnv, parentEnv);
  env['WORKSPACE_SEED_INPUT'] = JSON.stringify(input);
  let result;
  try {
    result = run(process.execPath, [path.join(repoRoot, entry.entry), 'seed-workspace', action], {
      cwd: repoRoot, env, shell: false, timeout: timeoutMs, maxBuffer: 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch { return held('APP_ACCESS_PROCESS_UNKNOWN'); }
  if (result.error || result.status !== 0) return held('APP_ACCESS_PROCESS_UNKNOWN');
  return receiptOf(result.stdout, action) ?? held('APP_ACCESS_RECEIPT_UNKNOWN');
}
