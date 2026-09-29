"use client"

import { i18n } from "../modules/i18n/config"
import messages from "../modules/i18n/messages/en.json"

interface GlobalErrorProps {
    readonly reset: () => void
}

/** Last-resort boundary above the locale layout: it has no provider, so it reads the default catalog directly. */
const GlobalError = ({ reset }: GlobalErrorProps) => (
    <html lang={i18n.DEFAULT_LOCALE}>
        <body>
            <main role="alert">
                <h1>{messages.errors.global.title}</h1>
                <button type="button" onClick={reset}>
                    {messages.errors.global.retry}
                </button>
            </main>
        </body>
    </html>
)

export default GlobalError
