import type { ReactNode } from "react"
import { readLocaleSegment } from "@ecommerce/i18n/layout"
import "../globals.css"
import "../../modules/brand"
import { LocaleShell } from "@ecommerce/ui"
import { AppProviders } from "../../components/providers/AppProviders"
import { ShopLayout } from "../../features/layouts/ShopLayout"

type LayoutProps = {
    readonly children: ReactNode
    readonly params: Promise<{ readonly locale: string }>
}

/**
 * NOT PRE-RENDERED, and saying so is the point: the request locale resolves per request, so the shell renders
 * dynamically rather than pre-building a page for a segment the build cannot guess. The pages read their data in the
 * browser, through the client providers mounted here.
 */
export const dynamic = "force-dynamic"

/** Mount the shared runtime context for the language the address states, the client providers and the shop shell. */
const Layout = async (props: LayoutProps) => (
    <LocaleShell {...await readLocaleSegment(props.params)}>
        <AppProviders>
            <ShopLayout content={props.children} />
        </AppProviders>
    </LocaleShell>
)

export default Layout
