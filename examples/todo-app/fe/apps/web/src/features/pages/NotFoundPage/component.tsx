import { GrammarRoot, Heading, PageContainer, TextAction, WorkspaceShell } from "@starci/grammar/common"
import { ROUTES } from "@/modules/routes"

/** Props for {@link NotFoundPageBase}. */
export type NotFoundPageBaseProps = {
    /** The words the page shows. */
    readonly props: {
        readonly title: string
        readonly homeLabel: string
    }
}

/** Draw the missing-page message and the way back to the product's front door. */
export const NotFoundPageBase = (props: NotFoundPageBaseProps) => (
    <GrammarRoot>
        <WorkspaceShell
            primaryLabel={props.props.title}
            primary={
                <PageContainer measure="reading">
                    <Heading level={1}>{props.props.title}</Heading>
                    <TextAction appearance="inline" href={ROUTES.signIn}>
                        {props.props.homeLabel}
                    </TextAction>
                </PageContainer>
            }
        />
    </GrammarRoot>
)
