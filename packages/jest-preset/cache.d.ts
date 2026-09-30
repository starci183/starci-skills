/** The declared key of a typed cache entry: `{ name, ttl, parse? }`. */
export interface FakeCacheKey<TValue = unknown> {
  readonly name: string
  readonly ttl: { readonly seconds: number }
  readonly parse?: (stored: unknown) => TValue | null
}
/** The typed-key request: the key plus the arguments that make the entry unique. */
export interface FakeCacheRequest<TValue = unknown> {
  readonly key: FakeCacheKey<TValue>
  readonly args?: ReadonlyArray<string>
}
export type FakeCacheEntry<TValue = unknown> = FakeCacheRequest<TValue> & { readonly value: TValue }

/** A behavioural in-memory cache: JSON round trip, expiry driven by the clock, inspection helpers. */
export interface FakeCache {
  get<TValue>(request: FakeCacheRequest<TValue>): Promise<TValue | null>
  get(text: string): Promise<unknown>
  set<TValue>(entry: FakeCacheEntry<TValue>): Promise<void>
  set(text: string, value: unknown, ttlMs?: number): Promise<void>
  del(request: FakeCacheRequest | string): Promise<void>
  /** Whether a live (not expired) entry exists. */
  has(request: FakeCacheRequest | string): boolean
  /** Seconds left before the entry expires (rounded up); null when absent, expired or without a ttl. */
  ttlOf(request: FakeCacheRequest | string): number | null
  /** The texts of the live entries. */
  keys(): string[]
  clear(): void
}

/** The cache double; `clock` is the `FakeClock` of the spec, so `clock.advance(ms)` expires entries. */
export declare function fakeCache(clock: { now(): Date }): FakeCache
