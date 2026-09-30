"use client"

import { DEFAULT_LOCALE, GLOBAL_ERROR_MESSAGES } from "@/modules/i18n"

interface GlobalErrorProps {
    readonly reset: () => void
}

/** Last-resort boundary above the locale layout: it has no provider, so it reads the default catalog directly. */
const GlobalError = ({ reset }: GlobalErrorProps) => (
    <html lang={DEFAULT_LOCALE}>
        <body>
            <main role="alert">
                <h1>{GLOBAL_ERROR_MESSAGES.title}</h1>
                <button type="button" onClick={reset}>
                    {GLOBAL_ERROR_MESSAGES.retry}
                </button>
            </main>
        </body>
    </html>
)

export default GlobalError
