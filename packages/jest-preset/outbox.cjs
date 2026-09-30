"use strict"

/**
 * `recordingOutbox()` -- an outbox double that records what a service writes, so a spec asserts on `outbox.messages`.
 *
 * `enqueue(manager, message)` records the message with the manager it was written through. `messages` is what the store
 * would hold: one message per (queue, eventId), like the real unique key, so a duplicate write keeps one. `writes` is every
 * call, duplicates included, and `entries` adds `inTransaction`: whether the manager was the view a `fakeTransaction` body
 * received, so a spec proves a message is written in the transaction of the change that caused it.
 *
 * The claim side scripts what a worker's claim returns. `queueRecords(...records)` fills the backlog; `claimDue(params)` hands
 * out, in order, up to `params.limit` backlog records whose queue is in `params.queues` and removes them, so an empty backlog is
 * an empty claim and queueing the same record twice is a duplicate delivery. `claims` keeps every claim's params, `completed`,
 * `retried` and `buried` keep what the worker reported, and `failNext(operation, error)` makes the next call of that operation
 * reject once, so a spec drives the failure path.
 */
const { isTransactionManager } = require("./entity-manager.cjs")

function recordingOutbox() {
  const written = []
  const backlog = []
  const claims = []
  const completed = []
  const retried = []
  const buried = []
  const failures = new Map()
  const failIfScripted = (operation) => {
    if (!failures.has(operation)) return
    const error = failures.get(operation)
    failures.delete(operation)
    throw error
  }
  return {
    async enqueue(manager, message) {
      failIfScripted("enqueue")
      written.push({ message, manager, inTransaction: isTransactionManager(manager) })
    },
    /** The messages the store would hold: the first write of each (queue, eventId). */
    get messages() {
      const seen = new Set()
      return written
        .filter(({ message }) => {
          const key = `${message.queue}\u0000${message.eventId}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        .map(({ message }) => message)
    },
    /** Every write, in order: `{ message, manager, inTransaction }`. */
    get entries() {
      return [...written]
    },
    /** Every message written, duplicates included. */
    get writes() {
      return written.map(({ message }) => message)
    },
    /** True when something was written and every write went through a transaction manager. */
    get allInTransaction() {
      return written.length > 0 && written.every((entry) => entry.inTransaction)
    },
    /** The stored messages of one queue. */
    messagesOf(queue) {
      return this.messages.filter((message) => message.queue === queue)
    },
    /** Adds records to the backlog `claimDue` hands out. */
    queueRecords(...records) {
      backlog.push(...records)
    },
    async claimDue(params) {
      claims.push(params)
      failIfScripted("claimDue")
      const claimed = []
      for (const record of [...backlog]) {
        if (claimed.length >= params.limit) break
        if (!params.queues.includes(record.queue)) continue
        claimed.push(record)
        backlog.splice(backlog.indexOf(record), 1)
      }
      return claimed
    },
    async complete(id) {
      failIfScripted("complete")
      completed.push(id)
    },
    async retry(params) {
      failIfScripted("retry")
      retried.push(params)
    },
    async bury(params) {
      failIfScripted("bury")
      buried.push(params)
    },
    /** Makes the next call of `operation` reject with `error`, once. */
    failNext(operation, error) {
      failures.set(operation, error)
    },
    /** The params of every `claimDue` call, in order. */
    get claims() {
      return [...claims]
    },
    /** The ids passed to `complete`, in order. */
    get completed() {
      return [...completed]
    },
    /** The params of every `retry`, in order. */
    get retried() {
      return [...retried]
    },
    /** The params of every `bury`, in order. */
    get buried() {
      return [...buried]
    },
    /** The records still waiting for a claim. */
    get backlog() {
      return [...backlog]
    },
    clear() {
      for (const list of [written, backlog, claims, completed, retried, buried]) list.length = 0
      failures.clear()
    },
  }
}

module.exports = { recordingOutbox }
