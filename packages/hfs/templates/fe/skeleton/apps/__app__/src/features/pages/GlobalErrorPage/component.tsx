import { FailureScreen } from "@/components/composites/FailureScreen"

/** Props for {@link GlobalErrorPageBase}. */
export type GlobalErrorPageBaseProps = {
    /** The language of the document and the words the failure shows. */
    readonly props: {
        readonly lang: string
        readonly title: string
        readonly retryLabel: string
    }
    /** What the surface reports upward. */
    readonly on: {
        readonly retry: () => void
    }
}

/** Draw the whole document, because this boundary replaces the root layout that would have drawn it. */
export const GlobalErrorPageBase = (props: GlobalErrorPageBaseProps) => (
    <html lang={props.props.lang}>
        <body>
            <FailureScreen title={props.props.title} retryLabel={props.props.retryLabel} onRetry={props.on.retry} />
        </body>
    </html>
)
