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

/** An outbox double that records writes. */
export interface RecordingOutbox<M extends RecordedMessage = RecordedMessage> {
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
  clear(): void
}

/** The outbox double. */
export declare function recordingOutbox<M extends RecordedMessage = RecordedMessage>(): RecordingOutbox<M>
