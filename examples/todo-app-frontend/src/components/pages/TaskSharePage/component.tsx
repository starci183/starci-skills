import { SharePage } from "@/features/pages/share"

/** The data the share screen wants from the route: the task the link binds to. */
export type TaskSharePageData = {
    readonly taskId: string
}

/** Props for {@link TaskSharePageBase}. */
export type TaskSharePageProps = {
    /** Whole-screen situations this surface settles; a resolved segment is always ready. */
    readonly state: "ready"
    /** The data payload for whatever state is showing. */
    readonly props: TaskSharePageData
    /** What the surface reports upward; the screen reports nothing. */
    readonly on: Record<never, never>
}

/** Draw the share screen for one task; the feature entry owns the invite and its copy state. */
export const TaskSharePageBase = (props: TaskSharePageProps) => (
    <SharePage taskId={props.props.taskId} />
)
