import type { ReactNode } from "react"
import { Providers } from "../../branches/Providers"

/** What the app's locale layout resolves before mounting the shell (the i18n package's readLocaleSegment). */
type LocaleShellProps = {
    readonly locale: string
    readonly messages: Record<string, unknown>
    readonly timeZone: string
    readonly children: ReactNode
}

/** The document of one route language: `<html lang>` from the address and the provider stack; the app's own chrome is the children. */
export const LocaleShell = (props: LocaleShellProps) => (
    <html lang={props.locale}>
        <body>
            <Providers locale={props.locale} messages={props.messages} timeZone={props.timeZone}>
                {props.children}
            </Providers>
        </body>
    </html>
)
