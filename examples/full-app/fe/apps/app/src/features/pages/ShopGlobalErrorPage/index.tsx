import { GlobalErrorNotice } from "@ecommerce/ui"
import { DEFAULT_LOCALE } from "@ecommerce/i18n"
import messages from "../../../modules/i18n/messages/en.json"

/** The public props of the shop's last-resort error page: the boundary hands it the retry. */
type ShopGlobalErrorPageProps = { readonly onRetry: () => void }

/**
 * The last-resort boundary above the locale layout of the shop. It has no provider, so it reads the default
 * catalog directly instead of asking next-intl.
 */
export const ShopGlobalErrorPage = (props: ShopGlobalErrorPageProps) => (
    <GlobalErrorNotice
        lang={DEFAULT_LOCALE}
        title={messages.shop.errors.global.title}
        retryLabel={messages.shop.errors.global.retry}
        onRetry={props.onRetry}
    />
)
