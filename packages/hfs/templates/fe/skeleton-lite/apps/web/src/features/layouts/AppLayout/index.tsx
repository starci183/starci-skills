import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import type { ReactNode } from "react"
import { SiteShell } from "@/components/composites/SiteShell"
import { siteUrl } from "@/modules/config"
import { APP_ROUTES } from "@/modules/routes"

type AppLayoutProps = { readonly content: ReactNode }

/** The document title and absolute metadata base for the requested locale. */
export const appLayoutMetadata = async (locale: string): Promise<Metadata> => {
    const t = await getTranslations({ locale, namespace: "app" })
    return { title: t("title"), metadataBase: new URL(siteUrl()) }
}

/** The server-resolved app chrome around the routed body. */
{{> fe/common/app-layout.tsx.partial}}
