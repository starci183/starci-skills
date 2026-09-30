import { navigation } from "@/modules/i18n"

/** The locale-aware router: `push` and `replace` take a locale-free path and keep the reader's language. */
export const useLocaleRouter = () => navigation.useRouter()
