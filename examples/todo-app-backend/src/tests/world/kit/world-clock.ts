import { SystemClockService } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"

/** The clock of the test world: the host clock through the `Clock` port, because the real apps the world boots run on it too. */
export const worldClock: Clock = new SystemClockService()
