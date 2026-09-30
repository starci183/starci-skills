import { ShareInviteBlock } from "@/components/blocks/share-invite"

/** Props for {@link TaskSharePageBase}. */
export type TaskSharePageBaseProps = {
    /** Whole-screen situations this surface settles; the block owns every hook and mutation. */
    readonly state: "ready"
    /** The data the share screen wants from the route: the task the link binds to. */
    readonly props: { readonly taskId: string }
    /** What the surface reports upward; the screen reports nothing. */
    readonly on: Record<never, never>
}

/** Draw the share screen for one task; the block owns every hook and mutation. */
export const TaskSharePageBase = (props: TaskSharePageBaseProps) => <ShareInviteBlock taskId={props.props.taskId} />
