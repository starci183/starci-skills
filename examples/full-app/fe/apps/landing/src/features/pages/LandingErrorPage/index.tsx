import { useTranslations } from "next-intl"
import { LandingErrorPageBase } from "./component"

/** The public props of the landing locale segment's error page: the boundary hands it the retry. */
type LandingErrorPageProps = { readonly onRetry: () => void }

/** A render failure in the landing shows this instead of a blank page; retry re-renders the segment. */
export const LandingErrorPage = (props: LandingErrorPageProps) => {
    const t = useTranslations("landing.errors.page")
    return <LandingErrorPageBase props={{ title: t("title"), retryLabel: t("retry") }} on={{ retry: props.onRetry }} />
}
