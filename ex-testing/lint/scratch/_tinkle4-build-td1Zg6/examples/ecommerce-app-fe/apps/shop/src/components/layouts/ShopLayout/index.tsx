"use client"

import { useCallback, type ReactNode } from "react"
import { useLocale, useTranslations } from "next-intl"
import { usePathname } from "@shared/i18n/navigation"
import { useTheme } from "@fe-kit/theme/theme-context"
import { ROUTES } from "../../../modules/routes"
import { ShopLayoutBase } from "./component"

/** Framework-layout boundary input: the routed page body and nothing else. */
export type ShopLayoutProps = { readonly content: ReactNode }

/** The primary sections, in bar order; the labels live in the dictionary, the paths in ROUTES. */
const LINKS = [
    { href: ROUTES.browse, key: "browse" },
    { href: ROUTES.cart, key: "cart" },
    { href: ROUTES.checkout, key: "checkout" },
    { href: ROUTES.account, key: "account" },
] as const

/**
 * The connected shop chrome. Everything the frame says and links to is resolved here - the chrome
 * copy from the shared dictionary, the locale-prefixed section links, the active-route marker, and
 * the theme answer GrammarRoot should paint - then the pure twin draws it. `usePathname` comes
 * from the i18n navigation, NOT `next/navigation`: the locale-aware helper returns the locale-free
 * path, so `isCurrent` keeps matching the locale-free `href` it always compared against.
 */
export const ShopLayout = (props: ShopLayoutProps) => {
    const t = useTranslations("shop.nav")
    const locale = useLocale()
    const pathname = usePathname()
    const { resolvedTheme } = useTheme()
    const Body = useCallback(() => <>{props.content}</>, [props.content])
    return (
        <ShopLayoutBase
            state="ready"
            props={{
                theme: resolvedTheme ?? "system",
                brand: t("brand"),
                navLabel: t("label"),
                homeHref: `/${locale}${ROUTES.browse}`,
                links: LINKS.map((link) => ({
                    href: `/${locale}${link.href}`,
                    label: t(link.key),
                    isCurrent: pathname === link.href || pathname.startsWith(`${link.href}/`),
                })),
            }}
            on={{}}
            body={Body}
        />
    )
}
