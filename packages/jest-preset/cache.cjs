"use strict"

/**
 * `fakeCache(clock)` -- a behavioural in-memory double of a cache port.
 *
 * It keeps entries as JSON text (like a Redis-backed cache, so a Date comes back as a string and a `key.parse` narrows
 * what was stored), expires them from the `FakeClock` (`clock.advance(ms)` is a TTL expiry, no sleep), and offers the
 * inspection a spec needs: `has(key)`, `ttlOf(key)`, `keys()`.
 *
 * Two call shapes are served by the same object, so it stands in for either kind of cache dependency:
 *   - the typed-key port: `get({ key, args })`, `set({ key, args, value })`, `del({ key, args })`, where `key` is
 *     `{ name, ttl: { seconds }, parse? }` and the entry text is `<name>:<arg>:...`;
 *   - the cache-manager shape: `get(text)`, `set(text, value, ttlMs?)`, `del(text)`.
 * `has`, `ttlOf` and `del` accept a request or the entry text.
 */

const textOf = (request) => (typeof request === "string" ? request : [request.key.name, ...(request.args ?? [])].join(":"))

/** @param {{ now(): Date }} clock */
function fakeCache(clock) {
  if (!clock || typeof clock.now !== "function") throw new Error("fakeCache: pass the FakeClock the spec drives, fakeCache(clock)")
  const entries = new Map()

  const live = (text) => {
    const entry = entries.get(text)
    if (entry === undefined) return undefined
    if (entry.expiresAt !== null && clock.now().getTime() >= entry.expiresAt) {
      entries.delete(text)
      return undefined
    }
    return entry
  }

  return {
    async get(request) {
      const entry = live(textOf(request))
      if (entry === undefined) return null
      const stored = JSON.parse(entry.json)
      return typeof request === "string" || typeof request.key.parse !== "function" ? stored : request.key.parse(stored)
    },
    async set(request, value, ttlMs) {
      const text = textOf(request)
      const typed = typeof request !== "string"
      const stored = typed ? request.value : value
      const lifetimeMs = typed ? request.key.ttl.seconds * 1000 : ttlMs
      if (lifetimeMs !== undefined && !(lifetimeMs > 0)) throw new Error(`fakeCache: the ttl of ${text} must be positive`)
      entries.set(text, { json: JSON.stringify(stored), expiresAt: lifetimeMs === undefined ? null : clock.now().getTime() + lifetimeMs })
    },
    async del(request) {
      entries.delete(textOf(request))
    },
    /** Whether a live (not expired) entry exists. */
    has: (request) => live(textOf(request)) !== undefined,
    /** Seconds left before the entry expires (rounded up), null when there is no live entry or it never expires. */
    ttlOf(request) {
      const entry = live(textOf(request))
      if (entry === undefined || entry.expiresAt === null) return null
      return Math.ceil((entry.expiresAt - clock.now().getTime()) / 1000)
    },
    /** The texts of the live entries. */
    keys: () => [...entries.keys()].filter((text) => live(text) !== undefined),
    /** Drops every entry. */
    clear: () => entries.clear(),
  }
}

module.exports = { fakeCache }
