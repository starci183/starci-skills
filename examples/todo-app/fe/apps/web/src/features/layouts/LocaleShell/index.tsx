import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { hasLocale } from "next-intl"
import { getMessages, getTranslations } from "next-intl/server"
import type { ComponentType, ReactNode } from "react"
import { DisplayControlsBlock } from "@/components/blocks/display-controls"
import { routing } from "@/modules/i18n"

/** What the route's client providers take: the locale, its resolved catalogue and the tree they wrap. */
type LocaleProvidersProps = {
    readonly locale: string
    readonly messages: Record<string, unknown>
    readonly children: ReactNode
}

type LocaleShellProps = {
    readonly lang: string
    /**
     * The client providers of the route tree (`app/[locale]/providers.tsx`): React Aria's locale for
     * Grammar's controls and next-intl's client context. A client component cannot be declared in a
     * feature, so the route hands it in.
     */
    readonly providers: ComponentType<LocaleProvidersProps>
    readonly children: ReactNode
}

/** Resolve the tab copy for the language in the address. */
export const localeMetadata = async (lang: string): Promise<Metadata> => {
    if (!hasLocale(routing.locales, lang)) notFound()
    const t = await getTranslations("app")
    return { title: t("title"), description: t("description") }
}

/** Mount the shared providers and shell controls for one route language. */
export const LocaleShell = async (props: LocaleShellProps) => {
    if (!hasLocale(routing.locales, props.lang)) notFound()
    const messages = await getMessages()
    const Providers = props.providers
    return (
        <html lang={props.lang} suppressHydrationWarning>
            <body className="bg-background text-foreground">
                <Providers locale={props.lang} messages={messages}>
                    <DisplayControlsBlock />
                    {props.children}
                </Providers>
            </body>
        </html>
    )
}
