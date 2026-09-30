import "server-only"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

/** The routed pages whose document title the catalog carries under `meta`. */
type PageTitleKey =
    "tasks" | "signIn" | "shareInvite" | "notifyPreferences" | "notifyUnsubscribe" | "planUsage" | "recur" | "privacy"

/** The document title of one page, in the language of the request: what the tab, the history and a shared link show. */
export const pageMetadata = async (page: PageTitleKey): Promise<Metadata> => {
    const t = await getTranslations("meta")
    const titles: Record<PageTitleKey, string> = {
        tasks: t("tasks"),
        signIn: t("signIn"),
        shareInvite: t("shareInvite"),
        notifyPreferences: t("notifyPreferences"),
        notifyUnsubscribe: t("notifyUnsubscribe"),
        planUsage: t("planUsage"),
        recur: t("recur"),
        privacy: t("privacy"),
    }
    return { title: titles[page] }
}
