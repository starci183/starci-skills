import { DEFAULT_LOCALE } from "@/modules/i18n"
import messages from "@/modules/i18n/messages/vi.json"
import { GlobalErrorPageBase } from "./component"

/** The public props of the last-resort error page: the boundary hands it the retry. */
type GlobalErrorPageProps = { readonly onRetry: () => void }

/** The last-resort boundary above the locale layout: it has no provider, so it reads the default catalog directly. */
export const GlobalErrorPage = (props: GlobalErrorPageProps) => (
    <GlobalErrorPageBase
        props={{ lang: DEFAULT_LOCALE, title: messages.errors.global.title, retryLabel: messages.errors.global.retry }}
        on={{ retry: props.onRetry }}
    />
)
