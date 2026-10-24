import type { EnvSource } from "@modules/platform/config"
import type { OrderOptions } from "./order.options"

/** Reads the order options: the cursor signing key is required and has no default, so a cursor is never signed with a known value. */
export const parseOrderConfig = (env: EnvSource): OrderOptions => ({
    pageCursorKey: env.secret("ORDER_PAGE_CURSOR_KEY"),
})
