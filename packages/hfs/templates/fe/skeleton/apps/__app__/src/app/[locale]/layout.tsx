import type { Metadata } from "next"
import type { ReactNode } from "react"
import { LocaleShell, localeMetadata } from "@/features/layouts/LocaleShell"
import "../globals.css"

type LayoutProps = {
    readonly children: ReactNode
    readonly params: Promise<{ readonly locale: string }>
}

/** The localized document title of this route segment. */
export const generateMetadata = async (props: LayoutProps): Promise<Metadata> =>
    localeMetadata((await props.params).locale)

/** The locale segment's layout slot: it mounts the locale shell around the segment. */
const Layout = async (props: LayoutProps) => (
    <LocaleShell lang={(await props.params).locale}>{props.children}</LocaleShell>
)

export default Layout
