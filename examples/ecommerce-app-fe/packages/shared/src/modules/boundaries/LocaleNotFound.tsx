import { useTranslations } from "next-intl"
import { Link } from "../i18n/navigation"

/** Shown when a route calls `notFound()`. */
export const LocaleNotFound = () => {
    const t = useTranslations("notFound")
    return (
        <main>
            <h1>{t("title")}</h1>
            <Link href="/">{t("home")}</Link>
        </main>
    )
}
