"use strict"

/**
 * `recordingOutbox()` -- an outbox double that records what a service writes, so a spec asserts on `outbox.messages`.
 *
 * `enqueue(manager, message)` records the message with the manager it was written through. `messages` is what the store
 * would hold: one message per (queue, eventId), like the real unique key, so a duplicate write keeps one. `writes` is every
 * call, duplicates included, and `entries` adds `inTransaction`: whether the manager was the view a `fakeTransaction` body
 * received, so a spec proves a message is written in the transaction of the change that caused it.
 */
const { isTransactionManager } = require("./entity-manager.cjs")

function recordingOutbox() {
  const written = []
  return {
    async enqueue(manager, message) {
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
    clear() {
      written.length = 0
    },
  }
}

module.exports = { recordingOutbox }
