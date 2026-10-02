/** One claim or release of a delivery. */
export interface InboxEntry {
  readonly source: string
  readonly eventId: string
}
/** The inbox operations `failNext` can make reject. */
export type InboxOperation = "claim" | "release"

/** An `Inbox` double with the behaviour of the real claim. */
export interface FakeInbox {
  /** True for the first claim of a (source, eventId) pair, false for every later one until it is released. */
  claim(source: string, eventId: string): Promise<boolean>
  /** Gives the claim back, so the next claim of the pair answers true. */
  release(source: string, eventId: string): Promise<void>
  /** Marks a pair as already claimed (a redelivery). */
  seen(source: string, eventId: string): void
  /** Makes the next call of `operation` reject with `error`, once. */
  failNext(operation: InboxOperation, error: Error): void
  /** Every claim, in order, duplicates included. */
  readonly claims: ReadonlyArray<InboxEntry>
  /** The pairs held now: claimed and not released. */
  readonly claimed: ReadonlyArray<InboxEntry>
  /** Every release, in order. */
  readonly released: ReadonlyArray<InboxEntry>
  clear(): void
}

/** The inbox double. */
export declare function fakeInbox(): FakeInbox
