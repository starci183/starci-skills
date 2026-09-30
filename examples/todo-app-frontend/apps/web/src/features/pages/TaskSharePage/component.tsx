import { GrammarRoot } from "@starci/grammar/common"
import { ShareInviteBlock } from "@/components/blocks/share-invite"

/** The data the share screen wants from the route: the task the link binds to. */
type TaskSharePageBaseProps = {
    readonly taskId: string
}

/** Draw the share screen for one task inside Grammar's Common root; the block owns every hook and mutation. */
export const TaskSharePageBase = (props: TaskSharePageBaseProps) => (
    <GrammarRoot>
        <ShareInviteBlock taskId={props.taskId} />
    </GrammarRoot>
)
