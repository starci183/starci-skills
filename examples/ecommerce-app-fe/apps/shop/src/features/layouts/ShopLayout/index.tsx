import type { ReactNode } from "react"
import { getLocale, getTranslations } from "next-intl/server"
import { SHOP_ROUTES } from "../../../modules/routes"
import { ShopLayoutBase } from "./component"

/** Framework-layout boundary input: the routed page body and nothing else. */
type ShopLayoutProps = { readonly content: ReactNode }

/**
 * The shop chrome, resolved on the server: the brand copy and the locale-prefixed home link. The section
 * links and their active-route marker need the current path, so the nav is its own connected block; the
 * pure twin places it beside the display controls.
 */
export const ShopLayout = async (props: ShopLayoutProps) => {
    const t = await getTranslations("shop.nav")
    const tDisplay = await getTranslations("shop.display")
    const locale = await getLocale()
    return (
        <ShopLayoutBase
            state="ready"
            props={{
                brand: t("brand"),
                homeHref: `/${locale}${SHOP_ROUTES.browse}`,
                display: {
                    label: tDisplay("label"),
                    locale,
                    toLight: tDisplay("theme.toLight"),
                    toDark: tDisplay("theme.toDark"),
                    localeNames: { en: tDisplay("locale.en"), vi: tDisplay("locale.vi") },
                },
            }}
            on={{}}
        >
            {props.content}
        </ShopLayoutBase>
    )
}
