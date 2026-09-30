"use client"

import { i18n } from "../../../modules/i18n/config"
import messages from "../../../modules/i18n/messages/en.json"

/** What Next hands the global boundary: the re-render callback. */
export type GlobalErrorBoundaryProps = {
    readonly reset: () => void
}

/** Last-resort boundary above the locale layout: it has no provider, so it reads the default catalog directly. */
export const GlobalErrorBoundary = ({ reset }: GlobalErrorBoundaryProps) => (
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
