import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { AppHomePageBase } from "./component"

/** The document title of the home page, from the catalog of the requested locale. */
export const appHomeMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("app.home")
    return { title: t("title") }
}

/** The first page of the product app: a server component, so no catalog is shipped for it. */
export const AppHomePage = async () => {
    const t = await getTranslations("app.home")
    return <AppHomePageBase props={{ title: t("title") }} />
}
