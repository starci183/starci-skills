import { getTranslations } from "next-intl/server"
import { NotFoundPageBase } from "./component"

/** Shown when a route calls `notFound()`. */
export const NotFoundPage = async () => {
    const t = await getTranslations("notFound")
    return <NotFoundPageBase props={{ title: t("title"), homeLabel: t("home") }} />
}
