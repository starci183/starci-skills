import type { ReactNode } from "react"
import { readLocaleSegment } from "@ecommerce/i18n/layout"
import "../globals.css"
import "../../modules/brand"
import { LocaleShell } from "@ecommerce/ui"
import { ShopLayout } from "../../features/layouts/ShopLayout"

type LayoutProps = {
    readonly children: ReactNode
    readonly params: Promise<{ readonly locale: string }>
}

/**
 * NOT PRE-RENDERED, and saying so is the point: the request locale resolves per request, and the service reads
 * under this shell are per-request too, so the shell renders dynamically rather than pre-building a page for a
 * segment the build cannot guess.
 */
export const dynamic = "force-dynamic"

/** Mount the shared runtime context for the language the address states and hand the routed tree to the shop shell. */
const Layout = async (props: LayoutProps) => (
    <LocaleShell {...await readLocaleSegment(props.params)}>
        <ShopLayout content={props.children} />
    </LocaleShell>
)

export default Layout
