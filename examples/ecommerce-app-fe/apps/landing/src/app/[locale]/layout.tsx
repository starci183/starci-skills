import type { Metadata } from "next"
import { hasLocale } from "next-intl"
import { getMessages, getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import type { ReactNode } from "react"
import "@fontsource-variable/inter"
import "../globals.css"
import { LocaleShell } from "@ecommerce/shared"
import { SiteLayout } from "../../features/layouts/SiteLayout"
import { SHOP_URL } from "../../modules/config"
import { routing } from "../../modules/i18n"
import { ShopUrlProvider } from "../../modules/shop-url"

type LocaleLayoutProps = {
    readonly children: ReactNode
    readonly params: Promise<{ readonly locale: string }>
}

/**
 * The locale shell: the one place that knows which language everything below it is in - the same
 * shape starci-academy-fe's `[locale]` layout takes. The answer comes from the ADDRESS, so a
 * Vietnamese page has a Vietnamese URL rather than one URL that renders differently depending on
 * who is asking.
 *
 * NOT PRE-RENDERED, and saying so is the point: the request locale resolves per request, so the
 * shell renders dynamically rather than pre-building a page for a segment the build cannot guess.
 */
export const dynamic = "force-dynamic"

/**
 * Browser-level metadata for every route in this language - resolved, not declared, because the
 * tab title and the description a search engine reads are copy like any other. A static object
 * here would be the one English sentence left in the app.
 */
export const generateMetadata = async ({ params }: LocaleLayoutProps): Promise<Metadata> => {
    const { locale } = await params
    if (!hasLocale(routing.locales, locale)) notFound()
    const t = await getTranslations("app.landing")
    return { title: t("title"), description: t("description") }
}

/**
 * Mount the shared runtime context for one language and hand the routed tree to the site layout.
 * The shop origin is resolved once here, on the server, and carried to the chrome through its
 * provider.
 *
 * A segment is reader-supplied text. An unknown language is a route that does not exist, not a
 * request to fall back silently - falling back would serve English at a Vietnamese-looking URL
 * and quietly make every such link wrong.
 */
const Layout = async ({ children, params }: LocaleLayoutProps) => {
    const { locale } = await params
    if (!hasLocale(routing.locales, locale)) notFound()
    const messages = await getMessages()
    return (
        <LocaleShell locale={locale} messages={messages}>
            <ShopUrlProvider shopUrl={SHOP_URL}>
                <SiteLayout content={children} />
            </ShopUrlProvider>
        </LocaleShell>
    )
}

export default Layout
