import { FailureScreen } from "@/components/composites/FailureScreen"

/** Props for {@link ErrorPageBase}. */
export type ErrorPageBaseProps = {
    /** Whole-screen situations this surface settles; the error page only ever shows the failure. */
    readonly state: "failed"
    /** The words the failure shows. */
    readonly props: {
        readonly title: string
        readonly retryLabel: string
    }
    /** What the surface reports upward. */
    readonly on: {
        readonly retry: () => void
    }
}

/** Draw the failure of the locale segment with its one recovery action. */
export const ErrorPageBase = (props: ErrorPageBaseProps) => (
    <FailureScreen title={props.props.title} retryLabel={props.props.retryLabel} onRetry={props.on.retry} />
)
