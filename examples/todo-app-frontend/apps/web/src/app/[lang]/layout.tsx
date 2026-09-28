import type { Metadata } from "next"
import type { ReactNode } from "react"
import { LocaleShell, localeMetadata } from "@/features/layouts/LocaleShell"
import "../globals.css"

/** These session-gated routes resolve their shell per request. */
export const dynamic = "force-dynamic"

type LayoutProps = {
    readonly children: ReactNode
    readonly params: Promise<{ readonly lang: string }>
}

/** The localized browser title and description for this route segment. */
export const generateMetadata = async ({ params }: LayoutProps): Promise<Metadata> =>
    localeMetadata((await params).lang)

/** Adapt the route segment into the shared locale shell. */
const Layout = async ({ children, params }: LayoutProps) =>
    <LocaleShell lang={(await params).lang}>{children}</LocaleShell>

export default Layout
