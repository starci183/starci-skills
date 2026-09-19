import type { Metadata } from "next"
import { hasLocale } from "next-intl"
import { getMessages, getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import type { ReactNode } from "react"
import "@fontsource-variable/inter"
import "../globals.css"
import { routing } from "@shared/i18n/routing"
import { ShopLayout } from "../../components/layouts/ShopLayout"
import { AppProviders } from "../providers"

type LocaleLayoutProps = {
  readonly children: ReactNode;
  readonly params: Promise<{ readonly lang: string }>;
};

/**
 * The locale shell: the one place that knows which language everything below it is in - the same
 * shape starci-academy-fe's `[lang]` layout takes, and the same one the landing app mounts, so
 * `/vi` means the same thing on both origins. The answer comes from the ADDRESS, so a Vietnamese
 * page has a Vietnamese URL rather than one URL that renders differently depending on who is asking.
 *
 * NOT PRE-RENDERED, and saying so is the point: the request locale resolves per request, and the
 * service reads under this shell are per-request too, so the shell renders dynamically rather
 * than pre-building a page for a segment the build cannot guess.
 */
export const dynamic = "force-dynamic"

/**
 * Browser-level metadata for every route in this language - resolved, not declared, because the
 * tab title and the description a search engine reads are copy like any other. A static object
 * here would be the one English sentence left in the app.
 */
export const generateMetadata = async ({ params }: LocaleLayoutProps): Promise<Metadata> => {
    const { lang } = await params
    if (!hasLocale(routing.locales, lang)) notFound()
    const t = await getTranslations("app.shop")
    return { title: t("title"), description: t("description") }
}

/**
 * Mount the shared runtime context for one language and hand the routed tree to the shop shell.
 *
 * A segment is reader-supplied text. An unknown language is a route that does not exist, not a
 * request to fall back silently - falling back would serve English at a Vietnamese-looking URL
 * and quietly make every such link wrong.
 */
const Layout = async ({ children, params }: LocaleLayoutProps) => {
    const { lang } = await params
    if (!hasLocale(routing.locales, lang)) notFound()
    const messages = await getMessages()
    return (
    // `suppressHydrationWarning` is required by the theme switch and by nothing else: the provider
    // writes the resolved theme onto this element around hydration, so the server's markup and the
    // browser's first paint differ on purpose. Narrow - it covers this element's attributes only.
        <html lang={lang} suppressHydrationWarning>
            <body>
                <AppProviders locale={lang} messages={messages}>
                    <ShopLayout content={children} />
                </AppProviders>
            </body>
        </html>
    )
}

export default Layout
