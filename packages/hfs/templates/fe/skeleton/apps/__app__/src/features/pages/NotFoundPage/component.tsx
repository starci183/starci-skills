import { GrammarRoot, Heading, PageContainer, TextAction, WorkspaceShell } from "@starci/grammar/common"
import { ROUTES } from "@/modules/routes"

/** Props for {@link NotFoundPageBase}. */
export type NotFoundPageBaseProps = {
    /** Whole-screen situations this surface settles; the not-found page only ever says the page is missing. */
    readonly state: "missing"
    /** The words the page shows. */
    readonly props: {
        readonly title: string
        readonly homeLabel: string
    }
    /** What the surface reports upward; the page reports nothing. */
    readonly on: Record<never, never>
}

/** Draw the missing-page message and the way back to the front door. */
export const NotFoundPageBase = (props: NotFoundPageBaseProps) => (
    <GrammarRoot>
        <WorkspaceShell
            primaryLabel={props.props.title}
            primary={
                <PageContainer measure="reading">
                    <Heading level={1}>{props.props.title}</Heading>
                    <TextAction appearance="inline" href={ROUTES.home}>
                        {props.props.homeLabel}
                    </TextAction>
                </PageContainer>
            }
        />
    </GrammarRoot>
)
