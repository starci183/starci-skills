// read-only-ledger.mjs - the ledger handle of a read verb whose caller owns none of its reactions.
//
// A read verb (a spec with `reads: true`) projects the ledger. Some of them (`starci kernel status`) also run mechanical reactions in
// the workflow's name: resolve a met wait, answer an ask, renew a lease, drain the Runs. Those writes belong to the roles that own the
// workflow's upkeep (its Kernel seat, the Supervisor, the reconciler and the settler, which export a runtime marker into their children);
// a person, Debug, a monitor or an op reading the verb gets the projection through a read-only connection and no reaction runs.
// A write attempted through the handle throws `read-verb-write` and is counted; the verb's run then fails with that code, so a read
// verb that writes is a loud bug and never a ledger write under the reader's own identity.
import path from 'node:path';
import { openLedgerReader, ledgerIdOf } from '../../engine/db/ledger.mjs';
import { readEnv } from '../lib/env.mjs';

const WRITE_SQL = /^\s*(?:INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER|BEGIN|COMMIT|VACUUM|REINDEX)\b/i;
const RUNTIME_ACTOR = /^(?:reconciler\/|supervisor$)/;
const RUNTIME_MARKERS = Object.freeze(['STARCI_API_CHILD', 'STARCI_CALLER']);

/** Whether the caller is a role that owns a workflow's reactions: its Kernel seat, the Supervisor, or a runtime child (reconciler, settler, api child). */
export function reactionOwner(caller, env = process.env) {
  if (caller?.role === 'kernel' || caller?.role === 'supervisor') return true;
  return RUNTIME_ACTOR.test(String(readEnv('STARCI_ACTOR', env) ?? '')) || RUNTIME_MARKERS.some((name) => readEnv(name, env));
}

/** A ledger handle over a read-only connection to `file`: every write call, and every write statement on its connection, throws and is counted in `attempts`. */
export function readOnlyLedger(file, { open = openLedgerReader } = {}) {
  const raw = open(file);
  const attempts = [];
  const refuse = (what) => {
    attempts.push(what);
    throw Object.assign(new Error(`${what}: a read verb does not write the ledger`), { code: 'read-verb-write' });
  };
  const guarded = (name, fn) => (sql, ...rest) => { if (WRITE_SQL.test(String(sql))) refuse(`${name}(${String(sql).trim().slice(0, 40)})`); return fn.call(raw, sql, ...rest); };
  const db = new Proxy(raw, { get: (target, name) => {
    if (name === 'prepare' || name === 'exec') return guarded(name, target[name]);
    const value = target[name];
    return typeof value === 'function' ? value.bind(target) : value;
  } });
  const transaction = Object.assign(() => refuse('transaction'), { active: () => false });
  const write = new Proxy({}, { get: (_target, name) => () => refuse(`write.${String(name)}`) });
  return { readOnly: true, file, path: path.resolve(file), db, now: Date.now, ledgerId: ledgerIdOf({ db: raw }), attempts, transaction, write,
    appendEvent: () => refuse('appendEvent'), enqueueJob: () => refuse('enqueueJob'), ensureWorkflow: () => refuse('ensureWorkflow'), close: () => raw.close() };
}
