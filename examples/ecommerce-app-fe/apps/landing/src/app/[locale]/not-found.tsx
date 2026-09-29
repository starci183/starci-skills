import { getTranslations } from "next-intl/server"
import { Link } from "../../modules/i18n"

/** Shown when a route calls `notFound()`. */
const NotFound = async () => {
    const t = await getTranslations("notFound")
    return (
        <main>
            <h1>{t("title")}</h1>
            <Link href="/">{t("home")}</Link>
        </main>
    )
}

export default NotFound
