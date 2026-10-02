import { Button, Heading, Region } from "@starci/grammar/common"
import { DEFAULT_LOCALE, GLOBAL_ERROR_MESSAGES } from "@/modules/i18n"

/** The public props of the last-resort error page: the boundary hands it the retry. */
type GlobalErrorPageProps = { readonly onRetry: () => void }

/**
 * The last-resort boundary above the locale layout. It has no provider, so it reads the default
 * catalog directly instead of asking next-intl, and draws the whole document itself.
 */
export const GlobalErrorPage = (props: GlobalErrorPageProps) => (
    <html lang={DEFAULT_LOCALE}>
        <body className="min-h-dvh">
            <Region label={GLOBAL_ERROR_MESSAGES.title}>
                <Heading level={1}>{GLOBAL_ERROR_MESSAGES.title}</Heading>
                <Button variant="primary" onPress={props.onRetry}>
                    {GLOBAL_ERROR_MESSAGES.retry}
                </Button>
            </Region>
        </body>
    </html>
)
