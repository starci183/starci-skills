import type { ReactNode } from "react"
import { LocaleShell } from "@{{project}}/ui"
import { AppLayout, appLayoutMetadata } from "@/features/layouts/AppLayout"
import { appI18n } from "@/modules/i18n"
import "../globals.css"

type LayoutProps = {
    readonly children: ReactNode
    readonly params: Promise<{ readonly locale: string }>
}

/** The localized document title of this route segment. */
export const generateMetadata = async (props: LayoutProps) => appLayoutMetadata((await props.params).locale)

/** The locale segment's layout slot: the document of the address's language around the product app's chrome. */
const Layout = async (props: LayoutProps) => (
    <LocaleShell {...await appI18n.readLocaleSegment(props.params)}>
        <AppLayout content={props.children} />
    </LocaleShell>
)

export default Layout
