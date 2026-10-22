import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { LandingPage } from "../../features/pages/LandingPage"
import { LANDING_NAMESPACE } from "../../modules/i18n"

/** The document title of the landing page, from the catalog of the requested locale. */
export const generateMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations(LANDING_NAMESPACE)
    return { title: t("title"), description: t("description") }
}

/** Mount the connected landing page and nothing else; the page owns its slice and its copy. */
const Page = () => <LandingPage />

export default Page
