import { RecurBlock } from "@/components/blocks/recur"

/** Props for {@link RecurPageBase}. */
export type RecurPageBaseProps = {
    /** Whole-screen situations this surface settles; the block owns the schedule lifecycle. */
    readonly state: "ready"
    /** The data the schedule screen wants from the route: the task title the query bound. */
    readonly props: { readonly taskTitle: string | null }
    /** What the surface reports upward; the screen reports nothing. */
    readonly on: Record<never, never>
}

/** Draw the recur schedule screen; the block owns the rest. */
export const RecurPageBase = (props: RecurPageBaseProps) => <RecurBlock taskTitle={props.props.taskTitle} />
