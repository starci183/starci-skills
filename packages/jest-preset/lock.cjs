"use strict"

/**
 * `fakeLock(clock)` -- a behavioural in-memory double of a lease (cross-replica lock with fencing).
 *
 * `acquire({ name, holder, ttlMs, at? })` grants `{ name, holder, fence }` when nobody holds the name (or the previous
 * ttl ran out on the clock) and answers `null` on contention; the fence grows with every grant of one name.
 * `release({ grant })` lets go only when the grant is still current. A holder acquiring its own live lease renews it.
 * Inspection: `isHeld(name)`, `holderOf(name)`, `fenceOf(name)`. Expiry is driven by the `FakeClock`; a request may carry
 * its own `at`, which wins.
 */

/** @param {{ now(): Date }} [clock] */
function fakeLock(clock) {
  const state = new Map()
  const fences = new Map()
  const nowOf = (params) => {
    const at = params.at ?? clock?.now()
    if (at === undefined) throw new Error("fakeLock: pass the FakeClock, fakeLock(clock), or an `at` on each acquire")
    return at.getTime()
  }
  const liveHold = (name) => {
    const hold = state.get(name)
    if (hold === undefined) return undefined
    if (clock !== undefined && clock.now().getTime() >= hold.expiresAt) {
      state.delete(name)
      return undefined
    }
    return hold
  }

  return {
    async acquire(params) {
      const at = nowOf(params)
      const held = state.get(params.name)
      const alive = held !== undefined && at < held.expiresAt
      if (alive && held.holder !== params.holder) return null
      const fence = alive ? held.fence : (fences.get(params.name) ?? 0) + 1
      fences.set(params.name, fence)
      state.set(params.name, { holder: params.holder, fence, expiresAt: at + params.ttlMs })
      return { name: params.name, holder: params.holder, fence }
    },
    async release({ grant }) {
      const held = state.get(grant.name)
      if (held !== undefined && held.fence === grant.fence && held.holder === grant.holder) state.delete(grant.name)
    },
    /** Whether a live lease exists for `name`. */
    isHeld: (name) => liveHold(name) !== undefined,
    /** The holder of the live lease, or null. */
    holderOf: (name) => liveHold(name)?.holder ?? null,
    /** The fence of the latest grant of `name`, or null when it was never granted. */
    fenceOf: (name) => fences.get(name) ?? null,
  }
}

module.exports = { fakeLock }
