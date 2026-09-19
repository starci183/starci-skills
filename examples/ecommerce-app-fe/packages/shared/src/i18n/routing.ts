import { createRouting } from "@fe-kit/i18n/routing"
import { i18n } from "./config"

/**
 * THE LOCALE IS PART OF THE ADDRESS.
 *
 * A Vietnamese page has a Vietnamese URL, so it can be linked, shared, bookmarked and indexed as
 * the thing the reader actually saw. The cookie stays in a smaller job: it no longer decides what
 * a URL means - the segment does - but it still remembers which language a returning reader chose,
 * so `/` sends them where they were rather than to the default every time.
 *
 * One routing object shared by both apps: `landing` and `shop` run on different origins, and a
 * reader carrying `/vi` from one to the other must land on a URL the second app agrees is real.
 */
export const routing = createRouting(i18n)
