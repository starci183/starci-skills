import { createNavigation } from "next-intl/navigation"
import { routing } from "./routing"

/** The locale served at the unprefixed path and used by the global error boundary. */
export { DEFAULT_LOCALE, PRODUCT_TIME_ZONE, routing } from "./routing"

/** Locale-aware navigation for client components. */
export const navigation = createNavigation(routing)
