import { RecurSchedulePage } from "@/components/recur"

/** The data the schedule screen wants from the route: the task title the query bound. */
export type RecurPageData = {
    readonly taskTitle: string | null
}

/** Props for {@link RecurPageBase}. */
export type RecurPageProps = {
    /** Whole-screen situations this surface settles; the schedule renders with or without a task. */
    readonly state: "ready"
    /** The data payload for whatever state is showing. */
    readonly props: RecurPageData
    /** What the surface reports upward; the screen reports nothing. */
    readonly on: Record<never, never>
}

/** Draw the recur schedule screen; the feature entry owns the workspace and its Grammar root. */
export const RecurPageBase = (props: RecurPageProps) => (
    <RecurSchedulePage taskTitle={props.props.taskTitle} />
)
