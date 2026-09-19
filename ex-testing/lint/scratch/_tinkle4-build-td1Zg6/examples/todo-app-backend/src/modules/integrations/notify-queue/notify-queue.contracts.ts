/**
 * integration.notify.queue's boundary: this port holds a delivery attempt's *next scheduled moment*
 * (a digest window's close, or a retry's backoff) between admission and dispatch - never rendered
 * message content, and never the dedupe key or digest grouping, both of which are notify's own logic
 * regardless of which queue technology carries the job between them.
 */
export abstract class NotifyQueuePort {
  /** Schedules `jobId` to become due at `dueAtMs` (epoch milliseconds). Enqueueing the same `jobId`
   * again before it is dequeued replaces its due time rather than creating a second entry - a job id is
   * a single scheduled moment, not a list of them. */
  abstract enqueue(jobId: string, dueAtMs: number): Promise<void>;

  /** Atomically returns and removes every job whose due time is at or before `nowMs`. A job returned by
   * one call is never returned again by a later one unless re-enqueued. */
  abstract dequeueDue(nowMs: number): Promise<Array<string>>;
}
