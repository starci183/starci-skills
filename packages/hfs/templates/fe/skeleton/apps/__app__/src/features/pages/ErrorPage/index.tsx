import { useTranslations } from "next-intl"
import { ErrorPageBase } from "./component"

/** The public props of the locale error page: the boundary hands it the retry. */
type ErrorPageProps = { readonly onRetry: () => void }

/** A render failure of the locale segment shows this instead of a blank page; retry re-renders the segment. */
export const ErrorPage = (props: ErrorPageProps) => {
    const t = useTranslations("errors.page")
    return (
        <ErrorPageBase
            state="failed"
            props={{ title: t("title"), retryLabel: t("retry") }}
            on={{ retry: props.onRetry }}
        />
    )
}
