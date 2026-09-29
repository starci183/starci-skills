import { getTranslations } from "next-intl/server"

/** Shown while a segment of the locale tree streams in. */
const Loading = async () => {
    const t = await getTranslations("loading")
    return (
        <main aria-busy="true">
            <p role="status">{t("label")}</p>
        </main>
    )
}

export default Loading
