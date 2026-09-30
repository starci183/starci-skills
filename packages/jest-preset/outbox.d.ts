/** A message as the outbox port takes it. */
export interface RecordedMessage {
  readonly queue: string
  readonly eventId: string
  readonly payload: object
  readonly availableAt?: Date
}
/** One recorded write. */
export interface OutboxWrite<M extends RecordedMessage = RecordedMessage> {
  readonly message: M
  readonly manager: unknown
  /** Whether the manager was the view a `fakeTransaction` body received. */
  readonly inTransaction: boolean
}
/** A message a worker has claimed, as the outbox port returns it. */
export interface ClaimedRecord {
  readonly id: string
  readonly queue: string
  readonly eventId: string
  readonly payload: unknown
  readonly attempts: number
}
/** What a worker asks for when it claims due messages. */
export interface ClaimParams {
  readonly at: Date
  readonly queues: ReadonlyArray<string>
  readonly limit: number
  readonly visibilityMs: number
}
/** What a worker reports when a delivery failed and should be tried again. */
export interface RetryParams {
  readonly id: string
  readonly at: Date
  readonly error: string
}
/** What a worker reports when a message will not be delivered any more. */
export interface BuryParams {
  readonly id: string
  readonly error: string
}
/** The outbox operations `failNext` can make reject. */
export type OutboxOperation = "enqueue" | "claimDue" | "complete" | "retry" | "bury"

/** An outbox double that records writes and scripts the claim side. */
export interface RecordingOutbox<M extends RecordedMessage = RecordedMessage, R extends ClaimedRecord = ClaimedRecord> {
  enqueue(manager: unknown, message: M): Promise<void>
  /** What the store would hold: the first write of each (queue, eventId). */
  readonly messages: ReadonlyArray<M>
  /** Every write with its manager, duplicates included. */
  readonly entries: ReadonlyArray<OutboxWrite<M>>
  /** Every message written, duplicates included. */
  readonly writes: ReadonlyArray<M>
  /** True when something was written and every write went through a `fakeTransaction` manager. */
  readonly allInTransaction: boolean
  messagesOf(queue: string): ReadonlyArray<M>
  /** Adds records to the backlog `claimDue` hands out; the same record twice is a duplicate delivery. */
  queueRecords(...records: ReadonlyArray<R>): void
  /** Hands out, in order, up to `limit` backlog records of the asked queues and removes them; an empty backlog is an empty claim. */
  claimDue(params: ClaimParams): Promise<Array<R>>
  complete(id: string): Promise<void>
  retry(params: RetryParams): Promise<void>
  bury(params: BuryParams): Promise<void>
  /** Makes the next call of `operation` reject with `error`, once. */
  failNext(operation: OutboxOperation, error: Error): void
  /** The params of every `claimDue` call. */
  readonly claims: ReadonlyArray<ClaimParams>
  /** The ids passed to `complete`. */
  readonly completed: ReadonlyArray<string>
  /** The params of every `retry`. */
  readonly retried: ReadonlyArray<RetryParams>
  /** The params of every `bury`. */
  readonly buried: ReadonlyArray<BuryParams>
  /** The records still waiting for a claim. */
  readonly backlog: ReadonlyArray<R>
  clear(): void
}

/** The outbox double. */
export declare function recordingOutbox<M extends RecordedMessage = RecordedMessage, R extends ClaimedRecord = ClaimedRecord>(): RecordingOutbox<M, R>
