import { ErrorNotice } from "@{{project}}/ui"

/** The error page's resolved words. */
type LandingErrorPageBaseProps = {
    readonly title: string
    readonly retryLabel: string
}

/** What the error page reads: its resolved words and its one command, retry the segment. */
type LandingErrorPageBaseContract = {
    readonly props: LandingErrorPageBaseProps
    readonly on: { readonly retry: () => void }
}

/** The pure error page of the landing: the screen a render failure shows, drawn from resolved words and one retry. */
export const LandingErrorPageBase = (props: LandingErrorPageBaseContract) => (
    <ErrorNotice title={props.props.title} retryLabel={props.props.retryLabel} onRetry={props.on.retry} />
)
