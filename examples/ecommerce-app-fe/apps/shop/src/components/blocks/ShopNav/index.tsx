"use client"

import { useLocale, useTranslations } from "next-intl"
import { useLocalePath } from "../../../hooks/navigation"
import { SHOP_ROUTES } from "../../../modules/routes"
import { ShopNavBase } from "./component"

/** The shop nav takes nothing from its layout: it reads the locale and the current path itself. */
type ShopNavProps = Record<never, never>

/** The primary sections, in bar order; the labels live in the dictionary, the paths in SHOP_ROUTES. */
const LINKS = [
    { href: SHOP_ROUTES.browse, key: "browse" },
    { href: SHOP_ROUTES.cart, key: "cart" },
    { href: SHOP_ROUTES.checkout, key: "checkout" },
    { href: SHOP_ROUTES.account, key: "account" },
] as const

/**
 * The connected shop nav. The locale-prefixed section links and the active-route marker are resolved here:
 * `useLocalePath` comes from the i18n navigation, NOT `next/navigation` - the locale-aware helper returns the
 * locale-free path, so `isCurrent` keeps matching the locale-free `href` it always compared against.
 */
export const ShopNav = (props: ShopNavProps) => {
    void props
    const t = useTranslations("shop.nav")
    const locale = useLocale()
    const pathname = useLocalePath()
    return (
        <ShopNavBase
            state="ready"
            props={{
                label: t("label"),
                links: LINKS.map((link) => ({
                    href: `/${locale}${link.href}`,
                    label: t(link.key),
                    isCurrent: pathname === link.href || pathname.startsWith(`${link.href}/`),
                })),
            }}
            on={{}}
        />
    )
}
