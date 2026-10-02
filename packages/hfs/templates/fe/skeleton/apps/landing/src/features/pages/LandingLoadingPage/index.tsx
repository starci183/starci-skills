import { getTranslations } from "next-intl/server"
import { LoadingNotice } from "@{{project}}/ui"

/** Shown while a route of the landing resolves. */
export const LandingLoadingPage = async () => {
    const t = await getTranslations("landing.loading")
    return <LoadingNotice label={t("message")} />
}
