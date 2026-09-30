import { GrammarRoot, Heading, Text } from "@starci/grammar/common"
import { AccountShell, type AccountShellCopy } from "@/components/composites/AccountShell"
import { TaskCollection, type TaskCollectionProps } from "@/components/composites/TaskCollection"
import { ROUTES } from "@/modules/routes"
import { TASK_LIST_INTRO_CLASS_NAME } from "./classNames"

/** Every word the task screen draws around its collection, resolved by the connected half. */
export type TaskListViewCopy = AccountShellCopy & {
    readonly heading: string
    readonly tagline: string
}

/** The task screen's complete contract: the chrome's words, the collection and the sign-out intent. */
export type TaskListViewProps = {
    readonly copy: TaskListViewCopy
    readonly collection: TaskCollectionProps
    readonly onSignOut: () => void
}

/** The pure render of the task screen: the workspace chrome, the heading block and the collection. */
export const TaskListView = (props: TaskListViewProps) => (
    <GrammarRoot data-state={props.collection.state}>
        <AccountShell copy={props.copy} currentHref={ROUTES.tasks} onSignOut={props.onSignOut}>
            <div className={TASK_LIST_INTRO_CLASS_NAME}>
                <Heading level={1} scale="display">
                    {props.copy.heading}
                </Heading>
                <Text tone="muted">{props.copy.tagline}</Text>
            </div>
            <TaskCollection {...props.collection} />
        </AccountShell>
    </GrammarRoot>
)
