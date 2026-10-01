import { GrammarRoot, PageContainer, Spinner, WorkspaceShell } from "@starci/grammar/common"

/** Props for {@link LoadingPageBase}. */
export type LoadingPageBaseProps = {
    /** The words the wait announces. */
    readonly props: { readonly message: string }
}

/** Draw the wait as one announced spinner. */
export const LoadingPageBase = (props: LoadingPageBaseProps) => (
    <GrammarRoot>
        <WorkspaceShell
            primaryLabel={props.props.message}
            primary={
                <PageContainer measure="reading">
                    <Spinner label={props.props.message} />
                </PageContainer>
            }
        />
    </GrammarRoot>
)
