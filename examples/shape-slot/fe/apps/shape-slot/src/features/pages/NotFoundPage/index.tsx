import { getTranslations } from "next-intl/server"
import { Heading, Region } from "@starci/grammar/common"

/** Shown when a route of the workspace calls `notFound()`. */
export const NotFoundPage = async () => {
    const t = await getTranslations("notFound")
    return (
        <Region label={t("title")}>
            <Heading level={1}>{t("title")}</Heading>
        </Region>
    )
}
