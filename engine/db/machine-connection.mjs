import { installRefResolver } from './ref-value.mjs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { sleepSync as scaledSleepSync } from '../../scripts/lib/sleep-sync.mjs';

const require = createRequire(import.meta.url);
export const MACHINE_BUSY_TIMEOUT_MS = 15000;
export const MACHINE_BUSY_CODE = 'STARCI_MACHINE_BUSY';
export const MACHINE_CORRUPT_CODE = 'STARCI_MACHINE_CORRUPT';
const OPEN_RETRY_DELAYS_MS = Object.freeze([0, 300, 900]);
const BUSY_RETRY_DELAYS_MS = Object.freeze([100, 300, 900, 2000]);
export const CORRUPT_RETRY_DELAYS_MS = Object.freeze([25, 150, 600]);
export const waitForRetry = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
export const isMachineBusy = (error) => error?.code === MACHINE_BUSY_CODE;
export const isBusyError = (error) => error?.errcode === 5 || error?.errcode === 6 || /SQLITE_BUSY|database is (?:locked|busy)/i.test(String(error?.message ?? error));
export const isCorruptError = (error) => {
  if (!error) return false;
  if (error.code === MACHINE_CORRUPT_CODE) return true;
  const code = Number(error.errcode);
  if (Number.isInteger(code) && ((code & 0xff) === 11 || (code & 0xff) === 26)) return true;
  return /database disk image is malformed|file is not a database|SQLITE_CORRUPT|SQLITE_NOTADB/i.test(String(error.message ?? error));
};
export const errText = (error) => String(error?.message ?? error).slice(0, 500);
const busyError = (file, error, { retries, where }) => Object.assign(new Error(`machine-db-busy: ${file} ${where}: database still locked after busy_timeout and ${retries} retries: ${String(error?.message ?? error).slice(0, 200)}`),
  { code: MACHINE_BUSY_CODE, cause: error, file, retries, where });

/** Persistent corruption diagnostics observe the store and stderr without recording an incident. */
export function corruptDiagnostic(file, error, { retries, where }) {
  if (error?.code === MACHINE_CORRUPT_CODE) return error;
  const out = Object.assign(new Error(`machine-db-corrupt: ${file} ${where}: SQLITE_CORRUPT persisted after ${retries} reopen(s): ${errText(error)}`),
    { code: MACHINE_CORRUPT_CODE, cause: error, file, retries, where });
  let check = null;
  try {
    const { DatabaseSync } = require('node:sqlite');
    const db = installRefResolver(new DatabaseSync(file, { readOnly: true, timeout: MACHINE_BUSY_TIMEOUT_MS }));
    try { check = db.prepare('PRAGMA quick_check').all().map((r) => r.quick_check).slice(0, 20); } finally { db.close(); }
  } catch (e) { check = [`quick_check failed: ${errText(e)}`]; }
  out.quickCheck = check;
  process.stderr.write(`[machine-db] INCIDENT ${out.message} (quick_check: ${JSON.stringify(check)})\n`);
  return out;
}

/** Which open failure is retryable: a busy wait, an 'unable to open' reopen, or a first corrupt hit; null rethrows. */
const openFailureKind = (error) => {
  if (isBusyError(error) && !isCorruptError(error)) return 'busy';
  if (/unable to open/i.test(String(error?.message ?? ''))) return 'open';
  if (isCorruptError(error) && error.code !== MACHINE_CORRUPT_CODE) return 'corrupt';
  return null;
};

const transientBusy = (error) => isBusyError(error) && !isMachineBusy(error) && !isCorruptError(error);

function resilientConnection(openRaw, { file, inTransaction, onRecovered, onCorrupt }) {
  let raw = openRaw(), generation = 0;
  const reopen = () => { try { raw.close(); } catch { /* closed */ } raw = openRaw(); generation += 1; };
  const recoverCorrupt = (error, retries, where) => {
    if (!isCorruptError(error) || error.code === MACHINE_CORRUPT_CODE) throw error;
    if (inTransaction() || raw.isTransaction) throw error;
    if (retries >= CORRUPT_RETRY_DELAYS_MS.length) throw onCorrupt(file, error, { retries, where });
    waitForRetry(CORRUPT_RETRY_DELAYS_MS[retries]);
    try { reopen(); } catch (openError) { if (!isCorruptError(openError)) throw openError; }
  };
  const retrying = (where, op) => {
    let busyRetries = 0;
    for (let retries = 0; ; retries += 1) {
      try {
        const out = op();
        if (retries) onRecovered({ where, retries });
        return out;
      } catch (error) {
        if (!transientBusy(error)) { recoverCorrupt(error, retries, where); continue; }
        if (inTransaction() || raw.isTransaction) throw error;
        if (busyRetries >= BUSY_RETRY_DELAYS_MS.length) throw busyError(file, error, { retries: busyRetries, where });
        scaledSleepSync(BUSY_RETRY_DELAYS_MS[busyRetries]);
        busyRetries += 1;
        retries -= 1;
      }
    }
  };
  const prepare = (sql) => {
    let stmt = null, gen = -1;
    const settings = [];
    const current = () => {
      if (gen !== generation) {
        stmt = raw.prepare(sql);
        for (const [k, a] of settings) stmt[k](...a);
        gen = generation;
      }
      return stmt;
    };
    retrying(`prepare ${sql.slice(0, 80)}`, current);
    return new Proxy({}, {
      get(_, prop) {
        if (prop === 'run' || prop === 'get' || prop === 'all' || prop === 'iterate') return (...args) => retrying(`${prop} ${sql.slice(0, 80)}`, () => current()[prop](...args));
        if (typeof prop === 'string' && /^set[A-Z]/.test(prop)) return (...args) => { settings.push([prop, args]); return current()[prop](...args); };
        const value = current()[prop];
        return typeof value === 'function' ? value.bind(current()) : value;
      },
    });
  };
  return new Proxy({}, {
    get(_, prop) {
      if (prop === 'prepare') return prepare;
      if (prop === 'exec') return (sql) => retrying(`exec ${String(sql).slice(0, 80)}`, () => raw.exec(sql));
      if (prop === 'reopen') return reopen;
      if (prop === 'raw') return raw;
      const value = raw[prop];
      return typeof value === 'function' ? value.bind(raw) : value;
    },
  });
}

/** Connection retries share one policy; the machine owner supplies operational incident persistence. */
export function machineConnectionMethods({ reportIncident }) {
  function openWithRetry(openRaw, { file, onCorrupt = reportIncident }) {
    let lastError, busyOpens = 0, failures = 0;
    const retryOpenFailure = (error) => {
      lastError = error;
      const kind = openFailureKind(error);
      if (kind === null) throw error;
      if (kind === 'busy') {
        if (busyOpens >= BUSY_RETRY_DELAYS_MS.length) throw busyError(path.resolve(file), error, { retries: busyOpens, where: 'open' });
        scaledSleepSync(BUSY_RETRY_DELAYS_MS[busyOpens]);
        busyOpens += 1;
        return true;
      }
      failures += 1;
      return failures < OPEN_RETRY_DELAYS_MS.length;
    };
    for (;;) {
      if (failures && OPEN_RETRY_DELAYS_MS[failures]) waitForRetry(OPEN_RETRY_DELAYS_MS[failures]);
      try { return openRaw(); }
      catch (error) { if (!retryOpenFailure(error)) break; }
    }
    if (isCorruptError(lastError)) throw onCorrupt(path.resolve(file), lastError, { retries: OPEN_RETRY_DELAYS_MS.length - 1, where: 'open' });
    throw lastError;
  }

  function connectionState(openRaw, { file, inTransaction = () => false, onCorrupt = reportIncident }) {
    const recovered = [];
    const noteRecovered = (r) => {
      recovered.push({ ...r, at: Date.now() });
      process.stderr.write(`[machine-db] transient SQLITE_CORRUPT recovered after ${r.retries} reopen(s) at ${r.where} (${file})\n`);
    };
    const db = resilientConnection(openRaw, { file, inTransaction, onRecovered: noteRecovered, onCorrupt });
    return { db, recovered, noteRecovered, close() { try { db.close(); } catch { /* closed */ } } };
  }

  return { openWithRetry, connectionState };
}
