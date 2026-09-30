import { navigation } from "@ecommerce/i18n"

/** The path the reader is on, WITHOUT the locale segment, so it compares against the locale-free route constants. */
export const useLocalePath = () => navigation.usePathname()
