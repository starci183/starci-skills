import { GrammarRoot, PageContainer, Text, WorkspaceShell } from "@starci/grammar/common"

/** Props for {@link LoadingPageBase}. */
export type LoadingPageBaseProps = {
    /** The words the wait announces. */
    readonly props: { readonly message: string }
}

/** Draw the wait as one politely announced line. */
export const LoadingPageBase = (props: LoadingPageBaseProps) => (
    <GrammarRoot>
        <WorkspaceShell
            primaryLabel={props.props.message}
            primary={
                <PageContainer measure="reading">
                    <Text live="polite" tone="muted">
                        {props.props.message}
                    </Text>
                </PageContainer>
            }
        />
    </GrammarRoot>
)
