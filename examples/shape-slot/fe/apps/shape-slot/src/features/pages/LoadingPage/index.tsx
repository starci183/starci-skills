import { getTranslations } from "next-intl/server"
import { Region, Spinner } from "@starci/grammar/common"

/** Shown while a route of the workspace resolves its content. */
export const LoadingPage = async () => {
    const t = await getTranslations("loading")
    return (
        <Region label={t("label")}>
            <Spinner label={t("label")} />
        </Region>
    )
}
