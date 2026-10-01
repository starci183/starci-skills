import { useLocale } from "next-intl"
import { LOCALES, navigation, type Locale } from "@/modules/i18n"

/**
 * The language in the address and the move to another one: `switchTo` re-prefixes the page the
 * reader is already on, so switching language never drops them onto another page.
 */
export const useLocaleSwitch = () => {
    const locale = useLocale()
    const pathname = navigation.usePathname()
    const router = navigation.useRouter()
    return {
        locale,
        locales: LOCALES,
        switchTo: (next: Locale) => router.replace(pathname, { locale: next }),
    }
}
