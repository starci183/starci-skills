import "server-only"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

/** The document title of a page, from the `title` of its message namespace in the language of the request: what the tab, the history and a shared link show. */
export const pageMetadata = async (namespace: string): Promise<Metadata> => {
    const t = await getTranslations(namespace)
    return { title: t("title") }
}
