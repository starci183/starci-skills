import type { QueueDelivery } from "./queue.contracts"
import type { PgmqMessageRow, QueueMessageRow } from "./persistence/queue.rows"

/** How many deliveries a job gets before it is archived as failed. */
export const ATTEMPTS = 5

/** The pause after the first failed delivery; it doubles with every further failure. */
export const BACKOFF_MS = 1000

/** Whole seconds, rounded up: pgmq counts visibility timeouts in seconds. */
export const secondsOf = (ms: number): number => Math.ceil(ms / 1000)

/** The pause before the next attempt of a message read `readCount` times: BACKOFF_MS doubled per failure, in seconds. */
export const backoffSecondsOf = (readCount: number): number => secondsOf(BACKOFF_MS * 2 ** Math.max(0, readCount - 1))

/** True when the delivery that just failed was the last one the job gets. */
export const isExhausted = (readCount: number): boolean => readCount >= ATTEMPTS

/** The message of an enqueued job: the outbox row id travels with the payload. */
export const messageOf = (jobId: string, payload: object): QueueMessageRow => ({ jobId, payload })

/** The delivery a handler receives for one read message; a scheduler tick carries no job id and is known by its message id. */
export const deliveryOf = (queue: string, row: PgmqMessageRow): QueueDelivery => ({
    id: row.message.jobId ?? row.msg_id,
    queue,
    payload: row.message.payload ?? {},
    attempt: row.read_ct,
})
