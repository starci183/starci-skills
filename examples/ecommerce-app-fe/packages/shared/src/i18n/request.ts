import { createRequestConfig } from "@fe-kit/i18n/request"
import { PRODUCT_TIME_ZONE } from "./config"
import { routing } from "./routing"

/**
 * WHERE COPY COMES FROM, resolved once per request on the server - for whichever app is serving.
 *
 * Every string a reader sees is a key in `packages/shared/src/messages/*.json`, and a component
 * receives it already resolved. Both apps point their next-intl plugin at THIS one file: the
 * dictionaries are a single source, so the landing and the shop cannot ship two diverging copies
 * of the same sentence.
 *
 * The locale comes from the ROUTE. The middleware negotiates the `[lang]` segment and hands the
 * answer down through `requestLocale`; an unrecognised segment resolves to the default before the
 * message loader ever sees it, so a file that does not exist is never imported.
 *
 * THE ZONE IS FIXED, NOT INFERRED, and that is the point. Left unset, next-intl formats on the
 * server in the server's zone and on the client in the reader's - a markup mismatch React does
 * not patch up. One honest answer to "what day is it" is written down once, here.
 *
 * The resolution logic lives in `@starci-examples/fe-kit`; what stays here is the product-specific
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
