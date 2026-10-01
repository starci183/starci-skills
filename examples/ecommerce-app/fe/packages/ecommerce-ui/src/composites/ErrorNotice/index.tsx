import { Alert } from "@starci/grammar/common"

/** The words of a recoverable failure and the one way out of it. */
type ErrorNoticeProps = {
    readonly title: string
    readonly retryLabel: string
    /** Re-render the segment that failed. */
    readonly onRetry: () => void
}

/** A failure shown as an assertive banner with its one recovery action, in place of a blank page. */
export const ErrorNotice = (props: ErrorNoticeProps) => (
    <Alert title={props.title} tone="negative" action={{ label: props.retryLabel, onAction: props.onRetry }} />
)
