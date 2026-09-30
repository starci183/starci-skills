import "server-only"
import { hasLocale } from "next-intl"
import { getMessages } from "next-intl/server"
import { notFound } from "next/navigation"
import { routing } from "./index"

/**
 * What an app's `[locale]` layout resolves before it mounts the shell: the language the address states and
 * its catalogue. A segment is reader-supplied text. An unknown language is a route that does not exist, not a
 * request to fall back silently - falling back would serve English at a Vietnamese-looking URL and quietly
 * make every such link wrong.
 */
export const loadLocaleSegment = async (params: Promise<{ readonly locale: string }>) => {
    const { locale } = await params
    if (!hasLocale(routing.locales, locale)) notFound()
    return { locale, messages: await getMessages() }
}
