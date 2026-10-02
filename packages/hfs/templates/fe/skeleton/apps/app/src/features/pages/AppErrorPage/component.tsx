import { ErrorNotice } from "@{{project}}/ui"

/** Props for {@link AppErrorPageBase}. */
export type AppErrorPageBaseProps = {
    /** The words the failure shows, already resolved. */
    readonly props: {
        readonly title: string
        readonly retryLabel: string
    }
    /** What the surface reports upward. */
    readonly on: {
        readonly retry: () => void
    }
}

/** Draw the failure of the product app's locale segment with its one recovery action. */
export const AppErrorPageBase = (props: AppErrorPageBaseProps) => (
    <ErrorNotice title={props.props.title} retryLabel={props.props.retryLabel} onRetry={props.on.retry} />
)
