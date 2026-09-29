/**
 * The one result vocabulary of the transport: a call either has its payload or says why it has none.
 * A refusal never throws from here; the adapters that want an exception turn it into one at their own seam.
 */
export type Result<T> = {
  readonly ok: true;
  readonly data: T;
} | {
  readonly ok: false;
  readonly reason: string;
  readonly code?: string;
};
