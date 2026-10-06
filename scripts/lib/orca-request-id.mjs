// Deterministic Orca replay identity is pure; the API runner and launch admission share this one owner.
import crypto from 'node:crypto';
import { byCodeUnit } from './list.mjs';
export const requestValuePresent = (v) => v !== undefined && v !== null && v !== false && v !== '';

const canonical = (v) => {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (!v || typeof v !== 'object') return JSON.stringify(v ?? null);
  const fields = Object.keys(v).filter((k) => v[k] !== undefined).sort(byCodeUnit)
    .map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',');
  return `{${fields}}`;
};

/**
 * The deterministic --retry-request id of one mutation: the verb plus the
 * caller's ledger identity (workflow, job, lease, run, handle - never a clock
 * or a random value), so a restarted process derives the same id. Orca 1.4.209
 * accepts only a UUID here, so the id is the RFC 9562 UUIDv8 of that name under the one
 * namespace below.
 */
// The namespace of every --retry-request id the runtime derives: generated once, never changed (a new value would
// make a restarted process derive different ids and lose its replays).
export const ORCA_REQUEST_NAMESPACE = '96fe63b0-5b42-4411-8490-6b5ae7b7dcb2';

/** RFC 9562 UUIDv8 (custom): SHA-256 over the namespace's 16 bytes then the name's UTF-8 bytes, first 16 bytes, version 8, variant 10. */
export function uuidv8(namespace, name) {
  const ns = Buffer.from(String(namespace).replaceAll('-', ''), 'hex');
  const b = crypto.createHash('sha256').update(ns).update(Buffer.from(String(name), 'utf8')).digest().subarray(0, 16);
  b[6] = (b[6] & 0x0f) | 0x80;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function orcaRequestIdOf(verb, identity) {
  if (!identity || typeof identity !== 'object' || !Object.keys(identity).some((k) => requestValuePresent(identity[k])))
    throw new Error(`orcaCall ${verb}: a request-replay mutation needs its ledger identity (request: {...})`);
  return uuidv8(ORCA_REQUEST_NAMESPACE, `${verb}\0${canonical(identity)}`);
}
