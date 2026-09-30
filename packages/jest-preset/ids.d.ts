/** The platform ids port a spec injects `fakeIds()` for: `{ next(): string }`. */
export declare class FakeIds {
  constructor(prefix?: string)
  /** The next deterministic UUID-shaped id. */
  next(): string
  /** Every id handed out so far, in order. */
  readonly issued: ReadonlyArray<string>
  /** Starts the sequence over. */
  reset(): void
}

/** A deterministic id generator: `00000000-0000-4000-8000-000000000001`, `...0002`, ... */
export declare function fakeIds(prefix?: string): FakeIds
