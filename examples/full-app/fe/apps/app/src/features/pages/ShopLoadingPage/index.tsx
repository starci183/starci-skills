import { getTranslations } from "next-intl/server"
import { LoadingNotice } from "@ecommerce/ui"

/** Shown while a route of the shop resolves its session-gated content. */
export const ShopLoadingPage = async () => {
    const t = await getTranslations("shop.loading")
    return <LoadingNotice label={t("message")} />
}
