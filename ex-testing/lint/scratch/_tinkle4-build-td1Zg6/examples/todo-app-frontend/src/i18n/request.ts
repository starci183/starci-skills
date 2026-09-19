import { createRequestConfig } from "@fe-kit/i18n/request"
import { PRODUCT_TIME_ZONE } from "./config"
import { routing } from "./routing"

/**
 * WHERE COPY COMES FROM, resolved once per request on the server.
 *
 * Every string a reader sees is a key in `src/messages/*.json`, and a component receives it
 * already resolved. That is the same boundary the blocks already draw between their two halves:
 * the connected half knows who is looking and hands the presentational half words, so the
 * presentational half can be rendered from a test with no locale, no request and no provider.
 *
 * THE LOCALE COMES FROM THE ROUTE. `requestLocale` is next-intl's negotiated answer for this
 * request - the `[lang]` segment when one is present, otherwise the cookie/default the middleware
 * already chose - checked against the shipped vocabulary before it reaches the message loader.
 * (`next/root-params`, which the academy build uses, does not exist on this app's Next 15 line.)
 *
 * The resolution logic lives in `@starci-examples/fe-kit`; what stays here is the app-specific
 * half of it - which catalogue file each locale loads.
 */
export default createRequestConfig({
    routing,
    timeZone: PRODUCT_TIME_ZONE,
    messages: {
        en: () => import("../messages/en.json"),
        vi: () => import("../messages/vi.json"),
    },
})
