import { getTranslations } from "next-intl/server"
import { NotFoundNotice } from "@/components/composites/NotFoundNotice"
import { APP_ROUTES } from "@/modules/routes"

/** Shown when a route does not exist. */
export const AppNotFoundPage = async () => {
    const t = await getTranslations("app.notFound")
    return <NotFoundNotice title={t("title")} homeLabel={t("home")} homeHref={APP_ROUTES.home} />
}
