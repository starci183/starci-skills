import { Alert, GrammarRoot, PageContainer, WorkspaceShell } from "@starci/grammar/common"

/** Props for {@link GlobalErrorPageBase}. */
export type GlobalErrorPageBaseProps = {
    /** Whole-screen situations this surface settles; the global error page only ever shows the failure. */
    readonly state: "failed"
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
            <GrammarRoot>
                <WorkspaceShell
                    primaryLabel={props.props.title}
                    primary={
                        <PageContainer measure="reading">
                            <Alert
                                title={props.props.title}
                                tone="negative"
                                action={{ label: props.props.retryLabel, onAction: props.on.retry }}
                            />
                        </PageContainer>
                    }
                />
            </GrammarRoot>
        </body>
    </html>
)
