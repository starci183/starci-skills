import { createRequestConfig } from "@starci-examples/fe-kit/i18n/request"
import { PRODUCT_TIME_ZONE } from "./config"
import { routing } from "./routing"

/**
 * Where copy comes from, resolved once per request on the server. Every string a reader sees is a
 * key in this app's `messages/*.json`; the locale comes from the `[locale]` route segment, and an
 * unrecognised segment resolves to the default before the loader runs, so a missing file is never
 * imported. The timezone is fixed, not inferred, so the server and the hydrated client format the
 * same instant the same way.
 */
export default createRequestConfig({
    routing,
    timeZone: PRODUCT_TIME_ZONE,
    messages: {
        en: () => import("./messages/en.json"),
        vi: () => import("./messages/vi.json"),
    },
})
