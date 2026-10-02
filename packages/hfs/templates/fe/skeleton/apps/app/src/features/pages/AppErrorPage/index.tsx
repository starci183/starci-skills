import { useTranslations } from "next-intl"
import { AppErrorPageBase } from "./component"

/** The public props of the locale error page: the boundary hands it the retry. */
type AppErrorPageProps = { readonly onRetry: () => void }

/** A render failure in the product app shows this instead of a blank page; retry re-renders the segment. */
export const AppErrorPage = (props: AppErrorPageProps) => {
    const t = useTranslations("app.errors.page")
    return <AppErrorPageBase props={{ title: t("title"), retryLabel: t("retry") }} on={{ retry: props.onRetry }} />
}
