import type { ReactNode } from "react"
import { getLocale, getTranslations } from "next-intl/server"
import { SHOP_URL } from "../../../modules/config"
import { LANDING_ROUTES } from "../../../modules/routes"
import { SiteLayoutBase } from "./component"

/** Framework-layout boundary input: the routed page body and nothing else. */
type SiteLayoutProps = { readonly content: ReactNode }

/**
 * The site chrome, resolved on the server. Everything the frame says and links to is resolved here - the
 * chrome copy from the shared dictionary, the locale-prefixed anchors and the shop hand-off origin (a
 * server-only read) - then the pure twin draws it. The routed page crosses as JSX children so the twin
 * can place it inside the frame.
 */
export const SiteLayout = async (props: SiteLayoutProps) => {
    const t = await getTranslations("landing.shell")
    const tDisplay = await getTranslations("landing.display")
    const locale = await getLocale()
    return (
        <SiteLayoutBase
            props={{
                brand: t("brand"),
                display: {
                    label: tDisplay("label"),
                    locale,
                    toLight: tDisplay("theme.toLight"),
                    toDark: tDisplay("theme.toDark"),
                    localeNames: { en: tDisplay("locale.en"), vi: tDisplay("locale.vi") },
                },
                navLabel: t("navLabel"),
                catalogue: t("catalogue"),
                about: t("about"),
                enterShop: t("enterShop"),
                tagline: t("tagline"),
                shopCta: t("shopCta"),
                homeHref: `/${locale}`,
                catalogueHref: `/${locale}${LANDING_ROUTES.catalogue}`,
                aboutHref: `/${locale}${LANDING_ROUTES.about}`,
                shopHref: `${SHOP_URL}/${locale}`,
            }}
        >
            {props.content}
        </SiteLayoutBase>
    )
}
