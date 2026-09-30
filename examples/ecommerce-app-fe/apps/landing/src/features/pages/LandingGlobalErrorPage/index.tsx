import { GlobalErrorNotice } from "@ecommerce/ui"
import { DEFAULT_LOCALE } from "@ecommerce/i18n"
import messages from "../../../modules/i18n/messages/en.json"

/** The public props of the landing's last-resort error page: the boundary hands it the retry. */
type LandingGlobalErrorPageProps = { readonly onRetry: () => void }

/**
 * The last-resort boundary above the locale layout of the landing. It has no provider, so it reads the default
 * catalog directly instead of asking next-intl.
 */
export const LandingGlobalErrorPage = (props: LandingGlobalErrorPageProps) => (
    <GlobalErrorNotice
        lang={DEFAULT_LOCALE}
        title={messages.landing.errors.global.title}
        retryLabel={messages.landing.errors.global.retry}
        onRetry={props.onRetry}
    />
)
