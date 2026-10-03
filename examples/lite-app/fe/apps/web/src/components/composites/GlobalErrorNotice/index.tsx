import { Alert, GrammarRoot } from "@starci/grammar/common"

/** The document language, failure words and recovery action. */
type GlobalErrorNoticeProps = {
    readonly lang: string
    readonly title: string
    readonly retryLabel: string
    readonly onRetry: () => void
}

/** The last-resort failure replaces the layout and therefore draws the document itself. */
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
