import { hasLocale } from "next-intl"
import type { defineRouting } from "next-intl/routing"
import { getRequestConfig } from "next-intl/server"

type Routing = ReturnType<typeof defineRouting>

/** The requested locale when the app serves it, else the default one. */
export const resolveLocale = (routing: Routing, requested: string | undefined): string => (hasLocale(routing.locales, requested) ? requested : routing.defaultLocale)

/** The request config of an app: the resolved locale and the catalog the app loads for it. */
export const createRequestConfig = (routing: Routing, loadMessages: (locale: string) => Promise<Record<string, unknown>>) =>
    getRequestConfig(async ({ requestLocale }) => {
        const locale = resolveLocale(routing, await requestLocale)
        return { locale, messages: await loadMessages(locale) }
    })
