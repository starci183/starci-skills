import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import type { ReactNode } from "react"
import { SiteShell } from "@{{project}}/ui"
import { LANDING_ROUTES } from "@/modules/routes"

/** Framework-layout boundary input: the routed page body and nothing else. */
type LandingLayoutProps = { readonly content: ReactNode }

/** The document title and description of the landing, for the language in the address. */
export const landingLayoutMetadata = async (locale: string): Promise<Metadata> => {
    const t = await getTranslations({ locale, namespace: "landing" })
    return { title: t("title"), description: t("description") }
}

/** The landing's chrome, resolved on the server: the shared brand shell with the wordmark linking home, around the routed body. */
export const LandingLayout = async (props: LandingLayoutProps) => {
    const t = await getTranslations("landing.shell")
    return (
        <SiteShell brand={t("brand")} homeHref={LANDING_ROUTES.home}>
            {props.content}
        </SiteShell>
    )
}
