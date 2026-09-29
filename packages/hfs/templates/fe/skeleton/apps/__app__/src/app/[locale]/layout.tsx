import { hasLocale, NextIntlClientProvider } from "next-intl"
import { getMessages, setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"
import type { ReactNode } from "react"
import { routing } from "../../modules/i18n/routing"
import "../globals.css"

interface LocaleLayoutProps {
    readonly children: ReactNode
    readonly params: Promise<{ readonly locale: string }>
}

/** One static shell per served locale. */
export const generateStaticParams = () => routing.locales.map((locale) => ({ locale }))

/** Root layout: sets `<html lang>` from the route segment and gives client components only the `errors` namespace. */
const LocaleLayout = async ({ children, params }: LocaleLayoutProps) => {
    const { locale } = await params
    if (!hasLocale(routing.locales, locale)) notFound()
    setRequestLocale(locale)
    const messages = await getMessages()
    return (
        <html lang={locale}>
            <body className="min-h-dvh">
                <NextIntlClientProvider messages={{ errors: messages.errors }}>{children}</NextIntlClientProvider>
            </body>
        </html>
    )
}

export default LocaleLayout
