import { hasLocale, NextIntlClientProvider } from "next-intl"
import { getMessages, setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"
import type { ReactNode } from "react"
import { routing } from "@/modules/i18n"

/** Route input of the locale layout owner. */
type LocaleLayoutProps = {
    readonly params: Promise<{ locale: string }>
    readonly children: ReactNode
}

/**
 * The locale's document: resolves the request locale, mounts the provider stack with the client-side
 * namespaces and hands the routed tree to the segment's own layout.
 */
export const LocaleLayout = async (props: LocaleLayoutProps) => {
    const { locale } = await props.params
    if (!hasLocale(routing.locales, locale)) notFound()
    setRequestLocale(locale)
    const messages = await getMessages()
    return (
        <html lang={locale}>
            <body className="min-h-dvh">
                <NextIntlClientProvider
                    messages={{ errors: messages.errors, slot: messages.slot, sales: messages.sales }}
                >
                    {props.children}
                </NextIntlClientProvider>
            </body>
        </html>
    )
}
