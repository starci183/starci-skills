"use client"

import { useTranslations } from "next-intl"

interface ErrorPageProps {
    readonly reset: () => void
}

/** Boundary of the locale segment: a render failure shows this instead of a blank page, and retry re-renders the segment. */
const ErrorPage = ({ reset }: ErrorPageProps) => {
    const t = useTranslations("errors.page")
    return (
        <main role="alert">
            <h1>{t("title")}</h1>
            <button type="button" onClick={reset}>
                {t("retry")}
            </button>
        </main>
    )
}

export default ErrorPage
