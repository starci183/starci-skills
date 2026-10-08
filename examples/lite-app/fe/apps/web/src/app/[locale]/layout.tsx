import { hasLocale } from "next-intl"
import { getMessages } from "next-intl/server"
import { notFound } from "next/navigation"
import type { ReactNode } from "react"
import { AppLayout, appLayoutMetadata } from "@/features/layouts/AppLayout"
import { PRODUCT_TIME_ZONE, routing } from "@/modules/i18n"
import { Providers } from "./providers"
import "../globals.css"
import "@/modules/brand"

type LayoutProps = {
    readonly children: ReactNode
    readonly params: Promise<{ readonly locale: string }>
}

/** The localized document title of this route segment. */
export const generateMetadata = async (props: LayoutProps) => appLayoutMetadata((await props.params).locale)

/** The locale segment's document, providers and app chrome. */
const Layout = async (props: LayoutProps) => {
    const { locale } = await props.params
    if (!hasLocale(routing.locales, locale)) notFound()
    const messages = await getMessages()
    return (
        <AppLayout
            locale={locale}
            content={
                <Providers locale={locale} messages={messages} timeZone={PRODUCT_TIME_ZONE}>
                    {props.children}
                </Providers>
            }
        />
    )
}

export default Layout
