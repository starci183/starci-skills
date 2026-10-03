import { ErrorNotice } from "@/components/composites/ErrorNotice"

/** Props for the pure error page. */
export type AppErrorPageBaseProps = {
    readonly props: { readonly title: string; readonly retryLabel: string }
    readonly on: { readonly retry: () => void }
}

/** Draws the locale segment's recoverable failure. */
export const AppErrorPageBase = (props: AppErrorPageBaseProps) => (
    <ErrorNotice title={props.props.title} retryLabel={props.props.retryLabel} onRetry={props.on.retry} />
)
