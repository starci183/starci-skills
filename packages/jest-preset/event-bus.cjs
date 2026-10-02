"use strict"

/**
 * `recordingEventBus()` -- an `EventBus` double that records what a domain service publishes, so a spec asserts on `bus.events`.
 *
 * `publish(event, tx)` records the event with the manager it was written through. `events` is what the outbox would hold: one
 * event per (event name, event id), like the real unique key, so a duplicate publication keeps one. `writes` is every call, duplicates
 * included, and `entries` adds `inTransaction`: whether `tx` was the view a `fakeTransaction` body received, so a spec proves an event
 * is published in the transaction of the change that caused it. The name of an event is the static `eventName` of its class.
 *
 * The read side is scripted: `setPendingRetries(count)` sets what `pendingRetries(eventClass)` answers, `deadLetters(eventClass)`
 * returns what `queueDeadLetters(...letters)` filled, `requeue(id)` records the id, and `failNext(operation, error)` makes the next
 * call of that operation reject once, so a spec drives the failure path.
 */
const { isTransactionManager } = require("./entity-manager.cjs")

const nameOf = (event) => event.constructor.eventName

function recordingEventBus() {
  const written = []
  const letters = []
  const requeued = []
  const failures = new Map()
  let pending = 0
  const failIfScripted = (operation) => {
    if (!failures.has(operation)) return
    const error = failures.get(operation)
    failures.delete(operation)
    throw error
  }
  return {
    async publish(event, tx) {
      failIfScripted("publish")
      written.push({ event, tx, inTransaction: isTransactionManager(tx) })
    },
    async pendingRetries() {
      failIfScripted("pendingRetries")
      return pending
    },
    async deadLetters(eventClass) {
      failIfScripted("deadLetters")
      return letters.filter((letter) => letter.eventName === eventClass.eventName)
    },
    async requeue(id) {
      failIfScripted("requeue")
      requeued.push(id)
    },
    /** The events the outbox would hold: the first publication of each (event name, event id). */
    get events() {
      const seen = new Set()
      return written
        .filter(({ event }) => {
          const key = `${nameOf(event)}\u0000${event.eventId}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        .map(({ event }) => event)
    },
    /** Every publication, in order: `{ event, tx, inTransaction }`. */
    get entries() {
      return [...written]
    },
    /** Every event published, duplicates included. */
    get writes() {
      return written.map(({ event }) => event)
    },
    /** True when something was published and every publication went through a transaction manager. */
    get allInTransaction() {
      return written.length > 0 && written.every((entry) => entry.inTransaction)
    },
    /** The stored events of one class. */
    eventsOf(eventClass) {
      return this.events.filter((event) => nameOf(event) === eventClass.eventName)
    },
    /** Sets the answer of `pendingRetries`. */
    setPendingRetries(count) {
      pending = count
    },
    /** Adds dead letters `deadLetters` hands out. */
    queueDeadLetters(...items) {
      letters.push(...items)
    },
    /** The ids passed to `requeue`, in order. */
    get requeued() {
      return [...requeued]
    },
    /** Makes the next call of `operation` reject with `error`, once. */
    failNext(operation, error) {
      failures.set(operation, error)
    },
    clear() {
      for (const list of [written, letters, requeued]) list.length = 0
      pending = 0
      failures.clear()
    },
  }
}

module.exports = { recordingEventBus }
