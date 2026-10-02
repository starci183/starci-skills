import type { ReactNode } from "react"
import { AppLayout, appLayoutMetadata } from "@/features/layouts/AppLayout"
import { readLocaleSegment } from "@/modules/i18n/request"
import { Providers } from "./providers"
import "../globals.css"
import "../../modules/brand/brand.css"

type LayoutProps = {
    readonly children: ReactNode
    readonly params: Promise<{ readonly locale: string }>
}

/** The localized document title of this route segment. */
export const generateMetadata = async (props: LayoutProps) => appLayoutMetadata((await props.params).locale)

/** The locale segment's document, providers and app chrome. */
const Layout = async (props: LayoutProps) => {
    const locale = await readLocaleSegment(props.params)
    return (
        <html lang={locale.locale}>
            <body>
                <Providers {...locale}>
                    <AppLayout content={props.children} />
                </Providers>
            </body>
        </html>
    )
}

export default Layout
