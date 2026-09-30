import { hasLocale } from "next-intl"
import { redirect, routing } from "@ecommerce/i18n"
import { SHOP_ROUTES } from "../../../modules/routes"
import { ShopRootRedirectBase } from "./component"

/** The public props of the locale root route: the language the address states. */
type ShopRootRedirectProps = { readonly lang: string }

/**
 * The locale root has no visual surface: it sends the reader to the catalogue in the language the address
 * states, through the locale-aware `redirect`. An unrecognised segment never reaches here - the layout
 * answers it with a not-found first - but the default language is still the one fallback the type needs.
 */
export const ShopRootRedirect = (props: ShopRootRedirectProps) => {
    redirect({
        href: SHOP_ROUTES.browse,
        locale: hasLocale(routing.locales, props.lang) ? props.lang : routing.defaultLocale,
    })
    return <ShopRootRedirectBase state="redirecting" props={{}} on={{}} />
}
