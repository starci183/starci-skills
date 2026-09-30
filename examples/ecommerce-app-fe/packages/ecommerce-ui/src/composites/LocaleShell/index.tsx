import type { ReactNode } from "react"
import { Providers } from "../../branches/Providers"

/** Inputs the app's locale layout resolves before mounting the shell. */
type LocaleShellProps = {
    readonly locale: string
    readonly messages: Record<string, unknown>
    readonly children: ReactNode
}

/** The locale's document and provider stack; the app's own chrome is the children. */
export const LocaleShell = (props: LocaleShellProps) => (
    // The display controls change only the html element's attributes around hydration.
    <html lang={props.locale} suppressHydrationWarning>
        <body>
            <Providers locale={props.locale} messages={props.messages}>
                {props.children}
            </Providers>
        </body>
    </html>
)
