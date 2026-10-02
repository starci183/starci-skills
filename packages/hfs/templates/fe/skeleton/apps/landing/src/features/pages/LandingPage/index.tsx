import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { appUrl } from "@/modules/config"
import { LandingPageBase } from "./component"

/** The document title of the landing page, from the catalog of the requested locale. */
export const landingMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("landing.home")
    return { title: t("title") }
}

/** The landing page, resolved on the server: its copy from the catalog and the product app's origin from the config module. */
export const LandingPage = async () => {
    const t = await getTranslations("landing.home")
    return <LandingPageBase props={{ title: t("title"), lede: t("lede"), openApp: t("openApp"), appHref: appUrl() }} />
}
