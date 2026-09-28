import type { ReactNode } from "react"
import { SHOP_URL } from "../../../modules/config"
import { SiteLayout } from "../SiteLayout"
import { AppProviders } from "../../../modules/providers"

/** Inputs resolved by the Next layout adapter before mounting the landing shell. */
export type LocaleShellProps = {
    readonly locale: string
    readonly messages: Record<string, unknown>
    readonly content: ReactNode
}

/** The locale's document, provider stack and site chrome are one layout owner. */
export const LocaleShell = ({ locale, messages, content }: LocaleShellProps) => (
    // The theme provider changes only the html element's attributes around hydration.
    <html lang={locale} suppressHydrationWarning>
        <body>
            <AppProviders locale={locale} messages={messages} shopUrl={SHOP_URL}>
                <SiteLayout content={content} />
            </AppProviders>
        </body>
    </html>
)
