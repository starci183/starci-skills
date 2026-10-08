import type { ReactNode } from "react"
import { routing } from "@/modules/i18n"
import { LocaleLayout } from "@/features/layouts/LocaleLayout"
import "../globals.css"

/** Route input of the locale layout slot. */
export type LayoutProps = {
    readonly params: Promise<{ locale: string }>
    readonly children: ReactNode
}

/** One static tree per served locale. */
export const generateStaticParams = () => routing.locales.map((locale) => ({ locale }))

/** Route adapter: params become atoms, then the layout owner renders. */
const Layout = (props: LayoutProps) => <LocaleLayout params={props.params}>{props.children}</LocaleLayout>

export default Layout
