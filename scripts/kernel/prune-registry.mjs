#!/usr/bin/env node
// prune-registry.mjs — one-shot, idempotent maintenance of the machine registry (machine.sqlite `ledgers`).
//
//   node scripts/kernel/prune-registry.mjs [--machine <file>] [--dry-run] [--no-backup] [--json]
//
// Deletes the rows whose ledger file is missing or under the OS temp directory: what specs enrolled on the
// host registry before the test registry (engine/ledger-db.mjs TEST_REGISTRY_ENV, tests/setup/
// isolated-registry.mjs) existed. A ledger that exists outside the temp directory is never pruned, and a row
// still owning machine leases or budget reservations is kept (engine/ledger-db.mjs pruneRegistry). Before
// deleting anything it writes a consistent copy of the registry beside it (`<file>.bak-<stamp>`, VACUUM
// INTO) unless --no-backup. Running it twice prunes nothing the second time.
// Exit 0 done (or nothing to do), 2 bad arguments or no registry at --machine.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { machineFileFor, openMachine } from '../../engine/ledger-db.mjs';

const HELP = `Usage: node scripts/kernel/prune-registry.mjs [--machine <file>] [--dry-run] [--no-backup] [--json]

Prunes machine-registry rows whose ledger file is missing or under the OS temp directory.
--machine    the registry (default: this host's, engine/ledger-db.mjs machineFileFor)
--dry-run    count what would go; delete nothing, write no backup
--no-backup  skip the <file>.bak-<stamp> copy taken before deleting
--json       print the result as JSON`;

const stamp = (at) => new Date(at).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');

/** Prune `machineFile`; returns pruneRegistry's result plus {machine, backup}. */
export function pruneMachineRegistry({ machineFile = machineFileFor(), dryRun = false, backup = true, env = process.env, now = Date.now } = {}) {
  if (!fs.existsSync(machineFile)) return { ok: false, reason: `no registry at ${machineFile}`, machine: machineFile };
  const machine = openMachine({ file: machineFile, env });
  try {
    const plan = machine.pruneRegistry({ dryRun: true });
    let backupFile = null;
    if (!dryRun && backup && plan.pruned > 0) {
      backupFile = `${path.resolve(machineFile)}.bak-${stamp(now())}`;
      machine.db.prepare('VACUUM INTO ?').run(backupFile);
    }
    const result = dryRun ? plan : machine.pruneRegistry();
    return { ...result, machine: path.resolve(machineFile), backup: backupFile };
  } finally { machine.close(); }
}

function main(argv) {
  const has = (flag) => argv.includes(flag);
  if (has('--help') || has('-h')) { console.log(HELP); return 0; }
  const at = argv.indexOf('--machine');
  const known = new Set(['--machine', '--dry-run', '--no-backup', '--json']);
  const unknown = argv.filter((arg, i) => arg.startsWith('--') && !known.has(arg) && argv[i - 1] !== '--machine');
  if (unknown.length || (at >= 0 && !argv[at + 1])) { console.error(HELP); return 2; }
  const result = pruneMachineRegistry({ machineFile: at >= 0 ? path.resolve(argv[at + 1]) : machineFileFor(), dryRun: has('--dry-run'), backup: !has('--no-backup') });
  if (has('--json')) console.log(JSON.stringify(result, null, 2));
  else if (!result.ok) console.error(`prune-registry: ${result.reason}`);
  else console.log(`prune-registry: ${result.machine} ${result.before} -> ${result.after} rows (${result.dryRun ? 'dry run, would prune' : 'pruned'} ${result.pruned}: ${result.temp} temp, ${result.missing} missing; kept ${result.kept.length} holding leases)${result.backup ? `; backup ${result.backup}` : ''}`);
  return result.ok ? 0 : 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
