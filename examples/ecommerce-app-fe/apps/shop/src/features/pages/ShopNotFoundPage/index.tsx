import { getTranslations } from "next-intl/server"
import { NotFoundNotice } from "@ecommerce/ui"

/** Shown when a route of the shop calls `notFound()`. */
export const ShopNotFoundPage = async () => {
    const t = await getTranslations("shop.notFound")
    return <NotFoundNotice title={t("title")} homeLabel={t("home")} />
}
