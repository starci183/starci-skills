import { GrammarRoot, Heading, PageContainer, WorkspaceShell } from "@starci/grammar/common"

/** Props for {@link HomePageBase}. */
export type HomePageBaseProps = {
    /** Whole-screen situations this surface settles; the home page only ever shows its title. */
    readonly state: "ready"
    /** The words the page shows. */
    readonly props: { readonly title: string }
    /** What the surface reports upward; the page reports nothing. */
    readonly on: Record<never, never>
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
