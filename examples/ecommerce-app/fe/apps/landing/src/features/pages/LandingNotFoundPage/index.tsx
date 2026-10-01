import { getTranslations } from "next-intl/server"
import { NotFoundNotice } from "@ecommerce/ui"

/** Shown when a route of the landing calls `notFound()`. */
export const LandingNotFoundPage = async () => {
    const t = await getTranslations("landing.notFound")
    return <NotFoundNotice title={t("title")} homeLabel={t("home")} />
}
