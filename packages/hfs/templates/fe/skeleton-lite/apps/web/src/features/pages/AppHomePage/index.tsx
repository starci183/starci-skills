import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { AppGuideOverlay } from "@/features/overlays/AppGuideOverlay"
import { AppHomePageBase } from "./component"

/** The document title of the home page. */
export const appHomeMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("app.home")
    return { title: t("title") }
}

/** The front door (the session is client-side, drawn by the blocks the page composes). */
export const AppHomePage = async () => {
    const t = await getTranslations("app.home")
    return (
        <>
            <AppHomePageBase props={{ title: t("title") }} />
            <AppGuideOverlay />
        </>
    )
}
