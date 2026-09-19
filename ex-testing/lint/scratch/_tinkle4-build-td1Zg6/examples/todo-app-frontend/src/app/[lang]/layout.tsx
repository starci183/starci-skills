import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getMessages, getTranslations } from "next-intl/server"
import { hasLocale } from "next-intl"
import type { ReactNode } from "react"
import { routing } from "@/i18n/routing"
import { LocaleSwitcher } from "@fe-kit/theme/leaves/LocaleSwitcher"
import { ThemeToggle } from "@fe-kit/theme/leaves/ThemeToggle"
import { AppProviders } from "../providers"
import "../globals.css"

/**
 * The locale shell: the one place that knows which language everything below it is in.
 *
 * The answer comes from the ADDRESS, so two readers on two languages are on two URLs rather than
 * on one URL that renders differently depending on who is asking.
 *
 * THIS APP IS NOT PRE-RENDERED, AND SAYING SO IS THE POINT. Every screen behind this shell is
 * session-gated - each renders nothing at all until a token exists in the browser - so a
 * `generateStaticParams` would pre-build empty pages at compile time. Both fixable; neither worth
 * fixing to pre-build a blank screen.
 */
export const dynamic = "force-dynamic"

/**
 * Browser-level metadata for every route in this language.
 *
 * Resolved rather than declared, because the tab title and the description a search engine reads
 * are copy like any other. A static object here would have been the one English sentence left in
 * the app, and the one nobody would have noticed.
 */
export const generateMetadata = async (props: LayoutProps): Promise<Metadata> => {
    const { lang } = await props.params
    if (!hasLocale(routing.locales, lang)) notFound()
    const t = await getTranslations("app")
    return {
        title: t("title"),
        description: t("description"),
    }
}

/** The routed children and the language segment, in the shape the app router already hands down. */
type LayoutProps = {
    readonly children: ReactNode
    readonly params: Promise<{ readonly lang: string }>
}

/**
 * Mount the shared runtime context for one language and leave composition to the route adapters.
 *
 * @param props - The routed children and the language segment.
 */
const Layout = async ({ children, params }: LayoutProps) => {
    const { lang } = await params
    // A segment is reader-supplied text. An unknown language is a route that does not exist, not a
    // request to fall back silently - falling back would serve English at a Vietnamese-looking URL
    // and quietly make every such link wrong.
    if (!hasLocale(routing.locales, lang)) notFound()
    const messages = await getMessages()
    return (
    // `suppressHydrationWarning` is required by the theme switch and by nothing else: the
    // provider writes the resolved theme onto this element before React hydrates, so the
    // server's markup and the browser's first paint differ on purpose. Suppressing it here
    // is narrow - it covers this element's own attributes, not the tree below it.
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

export default Layout
