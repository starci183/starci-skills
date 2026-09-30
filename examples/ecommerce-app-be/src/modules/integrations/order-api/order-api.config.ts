import type { EnvSource } from "@modules/platform/config"
import type { OrderApiOptions } from "./order-api.options"

/** Reads the order api options: the URL is required, the timeout is a tunable with a literal default. */
export const parseOrderApiConfig = (env: EnvSource): OrderApiOptions => ({
    url: env.url("ORDER_API_URL"),
    timeoutMs: env.duration("ORDER_API_TIMEOUT", 3000),
})
