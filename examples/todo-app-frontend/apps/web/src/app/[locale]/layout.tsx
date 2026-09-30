import type { Metadata } from "next"
import type { ReactNode } from "react"
import { LocaleShell, localeMetadata } from "../../features/layouts/LocaleShell"
import { Providers } from "./providers"
import "../globals.css"
import "@/modules/brand"

/** These session-gated routes resolve their shell per request. */
export const dynamic = "force-dynamic"

type LayoutProps = {
    readonly children: ReactNode
    readonly params: Promise<{ readonly locale: string }>
}

/** The localized browser title and description for this route segment. */
export const generateMetadata = async (props: LayoutProps): Promise<Metadata> =>
    localeMetadata((await props.params).locale)

/** Adapt the route segment into the shared locale shell. */
const Layout = async (props: LayoutProps) => (
    <LocaleShell lang={(await props.params).locale} providers={Providers}>
        {props.children}
    </LocaleShell>
)

export default Layout
