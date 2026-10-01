import { DEFAULT_LOCALE } from "@/modules/i18n"
import messages from "@/modules/i18n/messages/en.json"
import { GlobalErrorPageBase } from "./component"

/** The public props of the last-resort error page: the boundary hands it the retry. */
type GlobalErrorPageProps = { readonly onRetry: () => void }

/**
 * The last-resort boundary above the locale layout. It has no provider, so it reads the default
 * catalog directly instead of asking next-intl.
 */
export const GlobalErrorPage = (props: GlobalErrorPageProps) => (
    <GlobalErrorPageBase
        props={{
            lang: DEFAULT_LOCALE,
            title: messages.errors.global.title,
            retryLabel: messages.errors.global.retry,
        }}
        on={{ retry: props.onRetry }}
    />
)
