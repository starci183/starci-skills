import { Alert, GrammarRoot, PageContainer, WorkspaceShell } from "@starci/grammar/common"

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

/** Draw the failure as an assertive banner with its one recovery action. */
export const ErrorPageBase = (props: ErrorPageBaseProps) => (
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
)
