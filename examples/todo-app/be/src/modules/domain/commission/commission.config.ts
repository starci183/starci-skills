import type { EnvSource } from "@modules/platform/config"
import type { CommissionOptions } from "./commission.options"

/** Reads the commission options: the rate is a tunable with a literal default of 30 percent. */
export const parseCommissionConfig = (env: EnvSource): CommissionOptions => ({
    bps: env.int("COMMISSION_BPS", 3000),
})
