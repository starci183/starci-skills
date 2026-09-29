/** The test double for the injected `Clock` port: `{ now(): Date }`, plus spec-only time control. */
export declare class FakeClock {
  constructor(at?: Date | number | string)

  /** The current instant. Matches the `Clock` port's `now(): Date`, so `FakeClock` satisfies it structurally. */
  now(): Date

  /** Moves the clock to `at`. */
  set(at: Date | number | string): void

  /** Moves the clock forward by `ms` milliseconds (negative moves it back). */
  advance(ms: number): void
}
