import { getTranslations } from "next-intl/server"

/** Shown when a route calls `notFound()`. */
const NotFound = async () => {
    const t = await getTranslations("notFound")
    return (
        <main>
            <h1>{t("title")}</h1>
        </main>
    )
}

export default NotFound
