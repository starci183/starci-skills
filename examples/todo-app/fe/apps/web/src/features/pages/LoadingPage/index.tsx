import { getTranslations } from "next-intl/server"
import { LoadingPageBase } from "./component"

/** Shown while a route of the locale segment resolves its session-gated content. */
export const LoadingPage = async () => {
    const t = await getTranslations("loading")
    return <LoadingPageBase props={{ message: t("message") }} />
}
