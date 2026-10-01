import { GrammarRoot, PageContainer, Spinner, WorkspaceShell } from "@starci/grammar/common"

/** Props for {@link LoadingPageBase}. */
export type LoadingPageBaseProps = {
    /** Whole-screen situations this surface settles; the loading page only ever waits. */
    readonly state: "loading"
    /** The words the wait announces. */
    readonly props: { readonly message: string }
    /** What the surface reports upward; a wait reports nothing. */
    readonly on: Record<never, never>
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
