import { createRouting } from "@fe-kit/i18n/routing"
import { i18n } from "./config"

/**
 * THE LOCALE IS PART OF THE ADDRESS.
 *
 * A Vietnamese page has a Vietnamese URL, so it can be linked, shared, bookmarked and indexed as
 * the thing the reader actually saw. A cookie cannot do any of those, because it is not in the
 * link.
 *
 * THE COOKIE STAYS, in a smaller job. It no longer decides what a URL means - the segment does -
 * but it still remembers which language a returning reader chose, so `/` sends them where they
 * were rather than to the default every time.
 */
export const routing = createRouting(i18n)
