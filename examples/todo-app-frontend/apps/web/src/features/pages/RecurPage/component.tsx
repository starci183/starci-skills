import { GrammarRoot } from "@starci/grammar/common"
import { RecurWorkspace } from "@/components/blocks/recur"

/** The data the schedule screen wants from the route: the task title the query bound. */
type RecurPageBaseProps = {
    readonly taskTitle: string | null
}

/** Draw the recur schedule screen inside Grammar's Common root; the workspace owns the rest. */
export const RecurPageBase = (props: RecurPageBaseProps) => (
    <GrammarRoot>
        <RecurWorkspace taskTitle={props.taskTitle} />
    </GrammarRoot>
)
