import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { HomePageBase } from "./component"

/** The document title of the home page, from the catalog of the requested locale. */
export const homeMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("home")
    return { title: t("title") }
}

/** The first page of the app: a server component, so no catalog is shipped for it. */
export const HomePage = async () => {
    const t = await getTranslations("home")
    return <HomePageBase props={{ title: t("title") }} />
}
