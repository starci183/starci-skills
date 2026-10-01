import { useTranslations } from "next-intl"
import { ErrorPageBase } from "./component"

/** The public props of the locale error page: the boundary hands it the retry. */
type ErrorPageProps = { readonly onRetry: () => void }

/**
 * The connected half of the locale segment's error boundary: a render failure shows this instead of a
 * blank page, and retry re-renders the segment. The copy is the `errors.page` namespace.
 */
export const ErrorPage = (props: ErrorPageProps) => {
    const t = useTranslations("errors.page")
    return (
        <ErrorPageBase
            props={{ title: t("title"), retryLabel: t("retry") }}
            on={{ retry: props.onRetry }}
        />
    )
}
