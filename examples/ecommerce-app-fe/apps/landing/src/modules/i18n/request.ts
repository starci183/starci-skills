import { createRequestConfig } from "@starci-examples/fe-kit/i18n/request"
import { withCommonMessages } from "@ecommerce/shared"
import { PRODUCT_TIME_ZONE } from "./config"
import { routing } from "./routing"

/**
 * Where copy comes from, resolved once per request on the server: this app's own
 * `messages/*.json` laid over the copy every app shares. The locale comes from the `[locale]`
 * route segment, and an unrecognised segment resolves to the default before the loader runs, so a
 * missing file is never imported. The timezone is fixed, not inferred, so the server and the
 * hydrated client format the same instant the same way.
 */
export default createRequestConfig({
    routing,
    timeZone: PRODUCT_TIME_ZONE,
    messages: withCommonMessages({
        en: () => import("./messages/en.json"),
        vi: () => import("./messages/vi.json"),
    }),
})
