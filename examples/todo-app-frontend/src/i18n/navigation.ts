import { createI18nNavigation } from "@fe-kit/i18n/navigation"
import { routing } from "./routing"

/**
 * NAVIGATION THAT KNOWS WHICH LANGUAGE THE READER IS IN.
 *
 * With the locale in the path, `push('/tasks')` has to mean `/vi/tasks` for a Vietnamese reader
 * and `/en/tasks` for an English one, and the difference cannot be left to each call site: one
 * forgotten prefix drops a reader out of their language mid-journey, and it is invisible until
 * somebody browsing in Vietnamese clicks that one link.
 *
 * So the prefixing happens HERE, once. Call sites keep writing the locale-free path they always
 * wrote and import these helpers instead of `next/navigation`; a file still importing from
 * `next/navigation` is a file that was missed.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createI18nNavigation(routing)
