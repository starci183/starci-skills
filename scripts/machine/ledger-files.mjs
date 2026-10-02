// ledger-files.mjs — which product ledgers the machine arbiter (machine.sqlite `ledgers`) registered and still counts:
// present on disk and not a fixture (under the OS temp directory, or under a directory named `fixture`/`fixtures`; a spec
// that once enrolled <fixture>/.starciwork/runtime.sqlite left a real-path fixture registered for good). Read by the
// allocation balance (scripts/agent/balance.mjs) and the RAM throttle's worker census (ram-throttle.mjs).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { machineFileFor, readMachine } from '../../engine/db/machine.mjs';

const norm = (file) => path.resolve(String(file)).replace(/\\/g, '/').toLowerCase();
const tempDirs = (env = process.env) => [...new Set([os.tmpdir(), env.TEMP, env.TMP].filter(Boolean).map(norm))];
const FIXTURE_SEGMENT = /^fixtures?$/i;

/**
 * True when a ledger path is a test fixture, never a product ledger: under the OS temp directory, or with a
 * directory segment named `fixture` or `fixtures` anywhere above the file.
 */
export function isFixtureLedgerPath(file, { env = process.env } = {}) {
  if (!file) return false;
  const resolved = norm(file);
  if (tempDirs(env).some((dir) => resolved.startsWith(`${dir}/`))) return true;
  return resolved.split('/').slice(0, -1).some((segment) => FIXTURE_SEGMENT.test(segment));
}

/**
 * The other product ledgers the machine arbiter registered: present on disk and not a fixture
 * (isFixtureLedgerPath). `machineFile` injects the registry (a spec's own machine.sqlite); it defaults to
 * the host's, resolved from `env`.
 */
export function machineLedgerFiles({ env = process.env, exclude = [], machineFile = null } = {}) {
  const skip = new Set(exclude.filter(Boolean).map(norm));
  const files = readMachine((m) => m.listLedgers().map((l) => l.file), [], { file: machineFile ?? machineFileFor(env), env });
  return [...new Set(files.filter(Boolean).map((file) => path.resolve(file)))]
    .filter((file) => !isFixtureLedgerPath(file, { env }) && !skip.has(norm(file)) && fs.existsSync(file));
}

