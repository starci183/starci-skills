"use strict"

/**
 * `fakeInbox()` -- the twin of `recordingOutbox()` for the delivery side: an `Inbox` double with the behaviour of the real
 * claim, so a spec asserts what a consumer or a signed webhook did with a delivery instead of stubbing `claim` by hand.
 *
 * `claim(source, eventId)` answers `true` for the first call of a (source, eventId) pair and `false` for every later one, like the
 * real unique key; `release(source, eventId)` gives the claim back, so the next claim of the pair answers `true` again.
 * `claims` is every claim in order, `claimed` the pairs that are held now, `released` every release, `seen(source, eventId)` marks a
 * pair as already delivered (a redelivery), and `failNext(operation, error)` makes the next call of that operation reject once, so
 * a spec drives the failure path.
 */
function fakeInbox() {
  const held = new Set()
  const claims = []
  const released = []
  const failures = new Map()
  const keyOf = (source, eventId) => `${source}\u0000${eventId}`
  const failIfScripted = (operation) => {
    if (!failures.has(operation)) return
    const error = failures.get(operation)
    failures.delete(operation)
    throw error
  }
  return {
    async claim(source, eventId) {
      failIfScripted("claim")
      claims.push({ source, eventId })
      const key = keyOf(source, eventId)
      if (held.has(key)) return false
      held.add(key)
      return true
    },
    async release(source, eventId) {
      failIfScripted("release")
      released.push({ source, eventId })
      held.delete(keyOf(source, eventId))
    },
    /** Marks a pair as already claimed, so the next `claim` of it answers `false` (a redelivery). */
    seen(source, eventId) {
      held.add(keyOf(source, eventId))
    },
    /** Makes the next call of `operation` reject with `error`, once. */
    failNext(operation, error) {
      failures.set(operation, error)
    },
    /** Every `claim`, in order, duplicates included. */
    get claims() {
      return [...claims]
    },
    /** The pairs held now: claimed and not released. */
    get claimed() {
      return [...held].map((key) => {
        const [source, eventId] = key.split("\u0000")
        return { source, eventId }
      })
    },
    /** Every `release`, in order. */
    get released() {
      return [...released]
    },
    clear() {
      held.clear()
      claims.length = 0
      released.length = 0
      failures.clear()
    },
  }
}

module.exports = { fakeInbox }
