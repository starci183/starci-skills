import { createNavigation } from "next-intl/navigation"
import { routing } from "./routing"

/** Locale-aware links and navigation; components import these instead of `next/link` and `next/navigation`. */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)
