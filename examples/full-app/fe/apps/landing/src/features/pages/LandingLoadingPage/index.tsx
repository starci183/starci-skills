import { getTranslations } from "next-intl/server"
import { LoadingNotice } from "@ecommerce/ui"

/** Shown while a route of the landing resolves its session-gated content. */
export const LandingLoadingPage = async () => {
    const t = await getTranslations("landing.loading")
    return <LoadingNotice label={t("message")} />
}
