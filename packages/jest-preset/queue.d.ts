/** One recorded job write. */
export interface QueueWrite {
  readonly queue: string
  readonly payload: object
  readonly tx: unknown
  /** Whether `tx` was the view a `fakeTransaction` body received. */
  readonly inTransaction: boolean
}

/** A `QueueOutbox` double that records the jobs a typed producer writes. */
export interface RecordingQueueOutbox {
  write(tx: unknown, queue: string, payload: object): Promise<void>
  /** Every job written, in order. */
  readonly jobs: ReadonlyArray<{ readonly queue: string; readonly payload: object }>
  /** Every write with its manager. */
  readonly entries: ReadonlyArray<QueueWrite>
  jobsOf(queue: string): ReadonlyArray<{ readonly queue: string; readonly payload: object }>
  /** True when something was written and every write went through a `fakeTransaction` manager. */
  readonly allInTransaction: boolean
  /** Makes the next write reject with `error`, once. */
  failNext(operation: "write", error: Error): void
  clear(): void
}

/** The queue outbox double. */
export declare function recordingQueueOutbox(): RecordingQueueOutbox
