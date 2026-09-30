import { createNavigation } from "next-intl/navigation"
import { routing } from "./routing"

/** Locale-aware link; components import it instead of `next/link`. */
export const { Link } = createNavigation(routing)
