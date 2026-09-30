import { useTranslations } from "next-intl"

/** Shown while a route of the locale segment resolves its session-gated content. */
export const LocaleLoading = () => {
    const t = useTranslations("loading")
    return (
        <main role="status" aria-live="polite">
            <p>{t("message")}</p>
        </main>
    )
}
