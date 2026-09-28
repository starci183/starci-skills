"use client"

import type { ReactNode } from "react"
import { useLocale, useTranslations } from "next-intl"
import { useTheme } from "@starci-examples/fe-kit/theme/theme-context"
import { useShopUrl } from "../../../hooks/shop"
import { ROUTES } from "../../../modules/routes"
import { SiteLayoutBase } from "./component"

/** Framework-layout boundary input: the routed page body and nothing else. */
export type SiteLayoutProps = { readonly content: ReactNode }

/**
 * The connected site chrome. Everything the frame says and links to is resolved here - the chrome
 * copy from the shared dictionary, the locale-prefixed anchors, the shop hand-off origin from the
 * server through `useShopUrl`, and the theme answer GrammarRoot should paint - then the pure twin
 * draws it. The routed page crosses as JSX children so the twin can place it inside the frame.
 */
export const SiteLayout = (props: SiteLayoutProps) => {
    const t = useTranslations("landing.shell")
    const locale = useLocale()
    const { resolvedTheme } = useTheme()
    const shopUrl = useShopUrl()
    return (
        <SiteLayoutBase
            state="ready"
            props={{
                theme: resolvedTheme ?? "system",
                brand: t("brand"),
                navLabel: t("navLabel"),
                catalogue: t("catalogue"),
                about: t("about"),
                enterShop: t("enterShop"),
                tagline: t("tagline"),
                shopCta: t("shopCta"),
                homeHref: `/${locale}`,
                catalogueHref: `/${locale}${ROUTES.catalogue}`,
                aboutHref: `/${locale}${ROUTES.about}`,
                shopHref: `${shopUrl}/${locale}`,
            }}
            on={{}}
        >
            {props.content}
        </SiteLayoutBase>
    )
}
