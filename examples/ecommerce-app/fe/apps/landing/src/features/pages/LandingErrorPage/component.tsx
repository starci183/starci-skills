import { ErrorNotice } from "@ecommerce/ui"

/** The error page's resolved inputs: both words arrived already settled. */
type LandingErrorPageBaseProps = {
    readonly title: string
    readonly retryLabel: string
}

/** The error page's one command: retry the segment. */
type LandingErrorPageBaseOn = { readonly retry: () => void }

/** What the error page reads: the one situation it draws, its resolved words and its retry. */
type LandingErrorPageBaseContract = {
    readonly props: LandingErrorPageBaseProps
    readonly on: LandingErrorPageBaseOn
}

/** The pure error page of the landing: the screen a render failure shows, drawn from resolved words and one retry. */
export const LandingErrorPageBase = (props: LandingErrorPageBaseContract) => (
    <ErrorNotice title={props.props.title} retryLabel={props.props.retryLabel} onRetry={props.on.retry} />
)
