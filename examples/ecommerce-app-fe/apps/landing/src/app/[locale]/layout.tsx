import type { ReactNode } from "react"
import { readLocaleSegment } from "@ecommerce/i18n"
import "../globals.css"
import "../../modules/brand"
import { LocaleShell } from "@ecommerce/ui"
import { SiteLayout } from "../../features/layouts/SiteLayout"

type LayoutProps = {
    readonly children: ReactNode
    readonly params: Promise<{ readonly locale: string }>
}

/**
 * NOT PRE-RENDERED, and saying so is the point: the request locale resolves per request, so the shell
 * renders dynamically rather than pre-building a page for a segment the build cannot guess.
 */
export const dynamic = "force-dynamic"

/** Mount the shared runtime context for the language the address states and hand the routed tree to the site layout. */
const Layout = async (props: LayoutProps) => (
    <LocaleShell {...await readLocaleSegment(props.params)}>
        <SiteLayout content={props.children} />
    </LocaleShell>
)

export default Layout
