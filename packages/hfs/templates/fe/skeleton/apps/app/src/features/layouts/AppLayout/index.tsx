import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import type { ReactNode } from "react"
import { SiteShell } from "@{{project}}/ui"
import { siteUrl } from "@/modules/config"
import { APP_ROUTES } from "@/modules/routes"

/** Framework-layout boundary input: the routed page body and nothing else. */
type AppLayoutProps = { readonly content: ReactNode }

/** The document title and the absolute base of every metadata URL, for the language in the address. */
export const appLayoutMetadata = async (locale: string): Promise<Metadata> => {
    const t = await getTranslations({ locale, namespace: "app" })
    return { title: t("title"), metadataBase: new URL(siteUrl()) }
}

/** The product app's chrome, resolved on the server: the shared brand shell with the wordmark linking home, around the routed body. */
export const AppLayout = async (props: AppLayoutProps) => {
    const t = await getTranslations("app.shell")
    return (
        <SiteShell brand={t("brand")} homeHref={APP_ROUTES.home}>
            {props.content}
        </SiteShell>
    )
}
