import { navigation } from "@ecommerce/i18n"

/** The locale-aware router: `push`, `replace` and `refresh` keep the reader's language. */
export const useLocaleRouter = () => navigation.useRouter()
