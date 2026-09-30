import type { ReactNode } from "react"
import { AppProviders } from "../AppProviders"

/** Inputs the app's locale layout resolves before mounting the shell. */
export type LocaleShellProps = {
    readonly locale: string
    readonly messages: Record<string, unknown>
    readonly children: ReactNode
}

/** The locale's document and provider stack; the app's own chrome is the children. */
export const LocaleShell = ({ locale, messages, children }: LocaleShellProps) => (
    // The theme provider changes only the html element's attributes around hydration.
    <html lang={locale} suppressHydrationWarning>
        <body>
            <AppProviders locale={locale} messages={messages}>
                {children}
            </AppProviders>
        </body>
    </html>
)
