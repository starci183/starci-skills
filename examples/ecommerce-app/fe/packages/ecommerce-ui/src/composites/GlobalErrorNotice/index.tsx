import { Alert, GrammarRoot } from "@starci/grammar/common"

/** The document language, the words of the failure and the one way out of it. */
type GlobalErrorNoticeProps = {
    readonly lang: string
    readonly title: string
    readonly retryLabel: string
    /** Re-render the whole app. */
    readonly onRetry: () => void
}

/** The last-resort failure: the whole document, drawn here because this boundary replaces the layout that would have drawn it. */
export const GlobalErrorNotice = (props: GlobalErrorNoticeProps) => (
    <html lang={props.lang}>
        <body>
            <GrammarRoot>
                <Alert
                    title={props.title}
                    tone="negative"
                    action={{ label: props.retryLabel, onAction: props.onRetry }}
                />
            </GrammarRoot>
        </body>
    </html>
)
