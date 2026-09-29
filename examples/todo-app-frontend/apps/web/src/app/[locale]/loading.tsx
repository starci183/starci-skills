import { getTranslations } from "next-intl/server"

/** Shown while a route of the locale segment resolves its session-gated content. */
const Loading = async () => {
    const t = await getTranslations("loading")
    return (
        <main role="status" aria-live="polite">
            <p>{t("message")}</p>
        </main>
    )
}

export default Loading
