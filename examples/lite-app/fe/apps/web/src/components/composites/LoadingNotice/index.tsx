import { Spinner } from "@starci/grammar/common"

/** The word a wait announces. */
type LoadingNoticeProps = { readonly label: string }

/** A wait shown as one announced spinner. */
export const LoadingNotice = (props: LoadingNoticeProps) => <Spinner label={props.label} />
