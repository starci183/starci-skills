/** An event as the bus port takes it: a class instance with a stable id; its name is the static `eventName` of its class. */
export interface RecordedEvent {
  readonly eventId: string
}
/** The static side of an event class. */
export interface RecordedEventClass {
  readonly eventName: string
}
/** One recorded publication. */
export interface EventWrite<E extends RecordedEvent = RecordedEvent> {
  readonly event: E
  readonly tx: unknown
  /** Whether `tx` was the view a `fakeTransaction` body received. */
  readonly inTransaction: boolean
}
/** A dead letter as the bus port returns it. */
export interface RecordedDeadLetter {
  readonly id: string
  readonly eventName: string
  readonly eventId: string
  readonly reason: string
  readonly attempts: number
}
/** The bus operations `failNext` can make reject. */
export type EventBusOperation = "publish" | "pendingRetries" | "deadLetters" | "requeue"

/** An `EventBus` double that records publications and scripts the read side. */
export interface RecordingEventBus<E extends RecordedEvent = RecordedEvent> {
  publish(event: E, tx: unknown): Promise<void>
  pendingRetries(eventClass: RecordedEventClass): Promise<number>
  deadLetters(eventClass: RecordedEventClass): Promise<ReadonlyArray<RecordedDeadLetter>>
  requeue(id: string): Promise<void>
  /** What the outbox would hold: the first publication of each (event name, event id). */
  readonly events: ReadonlyArray<E>
  /** Every publication with its manager, duplicates included. */
  readonly entries: ReadonlyArray<EventWrite<E>>
  /** Every event published, duplicates included. */
  readonly writes: ReadonlyArray<E>
  /** True when something was published and every publication went through a `fakeTransaction` manager. */
  readonly allInTransaction: boolean
  eventsOf(eventClass: RecordedEventClass): ReadonlyArray<E>
  /** Sets the answer of `pendingRetries`. */
  setPendingRetries(count: number): void
  /** Adds dead letters `deadLetters` hands out. */
  queueDeadLetters(...items: ReadonlyArray<RecordedDeadLetter>): void
  /** The ids passed to `requeue`. */
  readonly requeued: ReadonlyArray<string>
  /** Makes the next call of `operation` reject with `error`, once. */
  failNext(operation: EventBusOperation, error: Error): void
  clear(): void
}

/** The event bus double. */
export declare function recordingEventBus<E extends RecordedEvent = RecordedEvent>(): RecordingEventBus<E>
