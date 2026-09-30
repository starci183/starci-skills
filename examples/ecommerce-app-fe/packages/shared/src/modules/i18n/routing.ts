import { createRouting } from "@starci-examples/fe-kit/i18n/routing"
import { i18n } from "./config"

/**
 * The locale is part of the address: a Vietnamese page has a Vietnamese URL, so it can be linked,
 * shared and indexed as the thing the reader saw. The cookie only remembers which language a
 * returning reader chose, so `/` sends them where they were.
 */
export const routing = createRouting(i18n)
