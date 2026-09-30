/** What a caller asks for when it wants a named lease. */
export interface FakeLockAcquire {
  readonly name: string
  readonly holder: string
  readonly ttlMs: number
  /** The instant of the request; defaults to the clock of the double. */
  readonly at?: Date
}
/** A granted lease. */
export interface FakeLockGrant {
  readonly name: string
  readonly holder: string
  readonly fence: number
}

/** A behavioural in-memory lease: acquire, contention, release, ttl expiry on the clock, growing fence. */
export interface FakeLock {
  acquire(params: FakeLockAcquire): Promise<FakeLockGrant | null>
  release(params: { readonly grant: FakeLockGrant }): Promise<void>
  isHeld(name: string): boolean
  holderOf(name: string): string | null
  fenceOf(name: string): number | null
}

/** The lock double; expiry follows `clock`, so `clock.advance(ms)` frees a lease whose ttl ran out. */
export declare function fakeLock(clock?: { now(): Date }): FakeLock
