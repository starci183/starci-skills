import { ROUTES } from "../../../modules/routes"

/** The catalogue path for the locale supplied by Next's route segment. */
export const ShopRootRedirectPath = (locale: string): string => `/${locale}${ROUTES.browse}`
