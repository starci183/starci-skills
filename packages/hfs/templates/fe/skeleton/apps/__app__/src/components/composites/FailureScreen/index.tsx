import { Button, GrammarRoot, Heading, PageContainer, WorkspaceShell } from "@starci/grammar/common"

/** Props for {@link FailureScreen}. */
type FailureScreenProps = {
    /** What failed, said to the reader. */
    readonly title: string
    /** The label of the one recovery action. */
    readonly retryLabel: string
    /** Runs the recovery: the boundary re-renders what failed. */
    readonly onRetry: () => void
}

/** A whole-screen failure with its one recovery action: the drawing both error boundaries share. */
export const FailureScreen = (props: FailureScreenProps) => (
    <GrammarRoot>
        <WorkspaceShell
            primaryLabel={props.title}
            primary={
                <PageContainer measure="reading">
                    <Heading level={1}>{props.title}</Heading>
                    <Button variant="danger" onPress={props.onRetry}>
                        {props.retryLabel}
                    </Button>
                </PageContainer>
            }
        />
    </GrammarRoot>
)
