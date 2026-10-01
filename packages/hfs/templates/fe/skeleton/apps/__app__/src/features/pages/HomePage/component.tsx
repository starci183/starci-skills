import { GrammarRoot, Heading, PageContainer, WorkspaceShell } from "@starci/grammar/common"

/** Props for {@link HomePageBase}. */
export type HomePageBaseProps = {
    /** The words the page shows. */
    readonly props: { readonly title: string }
}

/** Draw the front door of the app. */
export const HomePageBase = (props: HomePageBaseProps) => (
    <GrammarRoot>
        <WorkspaceShell
            primaryLabel={props.props.title}
            primary={
                <PageContainer measure="reading">
                    <Heading level={1}>{props.props.title}</Heading>
                </PageContainer>
            }
        />
    </GrammarRoot>
)
