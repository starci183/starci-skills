import type { ReactNode } from "react"
import { ShopLayout } from "../ShopLayout"
import { AppProviders } from "../../../modules/providers"

/** Inputs resolved by the Next layout adapter before mounting the shop shell. */
export type LocaleShellProps = {
    readonly locale: string
    readonly messages: Record<string, unknown>
    readonly content: ReactNode
}

/** The locale's document, provider stack and shop chrome are one layout owner. */
export const LocaleShell = ({ locale, messages, content }: LocaleShellProps) => (
    // The theme provider changes only the html element's attributes around hydration.
    <html lang={locale} suppressHydrationWarning>
        <body>
            <AppProviders locale={locale} messages={messages}>
                <ShopLayout content={content} />
            </AppProviders>
        </body>
    </html>
)
