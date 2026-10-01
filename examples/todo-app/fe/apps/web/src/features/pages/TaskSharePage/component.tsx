import { ShareInviteBlock } from "@/components/blocks/share-invite"

/** Props for {@link TaskSharePageBase}. */
export type TaskSharePageBaseProps = {
    /** The data the share screen wants from the route: the task the link binds to. */
    readonly props: { readonly taskId: string }
}

/** Draw the share screen for one task; the block owns every hook and mutation. */
export const TaskSharePageBase = (props: TaskSharePageBaseProps) => <ShareInviteBlock taskId={props.props.taskId} />
