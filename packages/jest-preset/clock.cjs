"use strict"

/**
 * `FakeClock` -- the test double for the injected `Clock` port (`platform/clock`).
 *
 * Business code asks its `Clock` port for the time (`clock.now()`) instead of reading `Date.now()` or
 * `new Date()` ambiently (`no-ambient-clock`, R79). A spec then drives time explicitly: it starts the
 * clock at a chosen instant, advances it by a duration, or sets it to a new instant, all without a real
 * sleep and without a race against the wall clock.
 */

class FakeClock {
  /** @param {Date | number | string} [at] - The instant the clock starts at; defaults to now, once, at construction. */
  constructor(at) {
    this._now = at === undefined ? new Date() : new Date(at)
  }

  /** The current instant, matching the `Clock` port's `now(): Date`. */
  now() {
    return new Date(this._now.getTime())
  }

  /** Moves the clock to `at`. */
  set(at) {
    this._now = new Date(at)
  }

  /** Moves the clock forward by `ms` milliseconds (negative moves it back). */
  advance(ms) {
    this._now = new Date(this._now.getTime() + ms)
  }
}

module.exports = { FakeClock }
