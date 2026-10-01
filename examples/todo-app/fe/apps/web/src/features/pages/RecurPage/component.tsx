import { RecurBlock } from "@/components/blocks/recur"

/** Props for {@link RecurPageBase}. */
export type RecurPageBaseProps = {
    /** The data the schedule screen wants from the route: the task title the query bound. */
    readonly props: { readonly taskTitle: string | null }
}

/** Draw the recur schedule screen; the block owns the rest. */
export const RecurPageBase = (props: RecurPageBaseProps) => <RecurBlock taskTitle={props.props.taskTitle} />
