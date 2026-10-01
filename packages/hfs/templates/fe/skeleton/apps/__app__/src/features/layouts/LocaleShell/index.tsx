import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { hasLocale, NextIntlClientProvider } from "next-intl"
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server"
import type { ReactNode } from "react"
import { siteUrl } from "@/modules/config"
import { routing } from "@/modules/i18n"

type LocaleShellProps = {
    readonly lang: string
    readonly children: ReactNode
}

/** The document title and the absolute base of every metadata URL, for the language in the address. */
export const localeMetadata = async (lang: string): Promise<Metadata> => {
    if (!hasLocale(routing.locales, lang)) notFound()
    const t = await getTranslations({ locale: lang, namespace: "app" })
    return { title: t("title"), metadataBase: new URL(siteUrl()) }
}

/** The document of one route language: `<html lang>` from the address and the catalog handed to client components. */
export const LocaleShell = async (props: LocaleShellProps) => {
    if (!hasLocale(routing.locales, props.lang)) notFound()
    setRequestLocale(props.lang)
    const messages = await getMessages()
    return (
        <html lang={props.lang}>
            <body className="min-h-dvh">
                <NextIntlClientProvider locale={props.lang} messages={messages}>
                    {props.children}
                </NextIntlClientProvider>
            </body>
        </html>
    )
}
