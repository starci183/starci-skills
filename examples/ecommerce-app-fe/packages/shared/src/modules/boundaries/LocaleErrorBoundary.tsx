"use client"

import { useTranslations } from "next-intl"

/** What Next hands the locale segment's boundary: the re-render callback. */
export type LocaleErrorBoundaryProps = {
    readonly reset: () => void
}

/** Boundary of the locale segment: a render failure shows this instead of a blank page, and retry re-renders the segment. */
export const LocaleErrorBoundary = ({ reset }: LocaleErrorBoundaryProps) => {
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
