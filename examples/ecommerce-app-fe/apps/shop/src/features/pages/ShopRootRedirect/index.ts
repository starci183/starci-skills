import { ROUTES } from "../../../modules/routes"

/** The catalogue path for the locale supplied by Next's route segment. */
export const ShopRootRedirectPath = (lang: string): string => `/${lang}${ROUTES.browse}`
