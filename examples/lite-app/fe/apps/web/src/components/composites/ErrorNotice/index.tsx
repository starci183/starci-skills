import { Alert } from "@starci/grammar/common"

/** The words of a recoverable failure and its one recovery action. */
type ErrorNoticeProps = {
    readonly title: string
    readonly retryLabel: string
    readonly onRetry: () => void
}

/** A recoverable failure shown as an assertive banner. */
export const ErrorNotice = (props: ErrorNoticeProps) => (
    <Alert title={props.title} tone="negative" action={{ label: props.retryLabel, onAction: props.onRetry }} />
)
