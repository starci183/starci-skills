import { getTranslations } from "next-intl/server"
import { NotFoundNotice } from "@{{project}}/ui"
import { APP_ROUTES } from "@/modules/routes"

/** Shown when a route of the product app calls `notFound()`. */
export const AppNotFoundPage = async () => {
    const t = await getTranslations("app.notFound")
    return <NotFoundNotice title={t("title")} homeLabel={t("home")} homeHref={APP_ROUTES.home} />
}
