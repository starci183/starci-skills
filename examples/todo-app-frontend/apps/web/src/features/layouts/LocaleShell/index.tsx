import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { hasLocale } from "next-intl"
import { getMessages, getTranslations } from "next-intl/server"
import type { ReactNode } from "react"
import { LocaleSwitcher } from "@fe-kit/theme/leaves/LocaleSwitcher"
import { ThemeToggle } from "@fe-kit/theme/leaves/ThemeToggle"
import { routing } from "@/modules/i18n"
import { AppProviders } from "./component"

type LocaleShellProps = { readonly lang: string; readonly children: ReactNode }

/** Resolve the tab copy for the language in the address. */
export const localeMetadata = async (lang: string): Promise<Metadata> => {
    if (!hasLocale(routing.locales, lang)) notFound()
    const t = await getTranslations("app")
    return { title: t("title"), description: t("description") }
}

/** Mount the shared providers and shell controls for one route language. */
export const LocaleShell = async ({ lang, children }: LocaleShellProps) => {
    if (!hasLocale(routing.locales, lang)) notFound()
    const messages = await getMessages()
    return (
        <html lang={lang} suppressHydrationWarning>
            <body className="bg-background text-foreground">
                <AppProviders locale={lang} messages={messages}>
                    <div className="shell-controls">
                        <ThemeToggle />
                        <LocaleSwitcher />
                    </div>
                    {children}
                </AppProviders>
            </body>
        </html>
    )
}
