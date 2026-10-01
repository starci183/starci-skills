import { Spinner } from "@starci/grammar/common"

/** The word a wait announces. */
type LoadingNoticeProps = {
    readonly label: string
}

/** A wait shown as one announced spinner, while a route resolves its session-gated content. */
export const LoadingNotice = (props: LoadingNoticeProps) => <Spinner label={props.label} />
