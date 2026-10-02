"use strict"

/**
 * `recordingQueueOutbox()` -- a `QueueOutbox` double that records what a typed queue producer writes, so a spec asserts on `outbox.jobs`.
 *
 * `write(tx, queue, payload)` records the job with the manager it was written through. `jobs` is every job in order, `jobsOf(queue)`
 * the jobs of one queue, and `entries` adds `inTransaction`: whether `tx` was the view a `fakeTransaction` body received, so a spec proves
 * a job is enqueued in the transaction of the change that needs it. `failNext('write', error)` makes the next write reject once.
 */
const { isTransactionManager } = require("./entity-manager.cjs")

function recordingQueueOutbox() {
  const written = []
  const failures = new Map()
  return {
    async write(tx, queue, payload) {
      if (failures.has("write")) {
        const error = failures.get("write")
        failures.delete("write")
        throw error
      }
      written.push({ queue, payload, tx, inTransaction: isTransactionManager(tx) })
    },
    /** Every job written, in order: `{ queue, payload }`. */
    get jobs() {
      return written.map(({ queue, payload }) => ({ queue, payload }))
    },
    /** Every write with its manager and `inTransaction`. */
    get entries() {
      return [...written]
    },
    /** The jobs of one queue. */
    jobsOf(queue) {
      return this.jobs.filter((job) => job.queue === queue)
    },
    /** True when something was written and every write went through a transaction manager. */
    get allInTransaction() {
      return written.length > 0 && written.every((entry) => entry.inTransaction)
    },
    /** Makes the next write reject with `error`, once. */
    failNext(operation, error) {
      failures.set(operation, error)
    },
    clear() {
      written.length = 0
      failures.clear()
    },
  }
}

module.exports = { recordingQueueOutbox }
