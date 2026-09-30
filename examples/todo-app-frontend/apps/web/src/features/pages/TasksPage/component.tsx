import { TaskListBlock } from "@/components/blocks/task-list"

/** Props for {@link TasksPageBase}. */
export type TasksPageBaseProps = {
    /** Whole-screen situations this surface settles; the screen owns its own session gate. */
    readonly state: "ready"
    /** The data payload for whatever state is showing; the screen wants nothing from the route. */
    readonly props: Record<never, never>
    /** What the surface reports upward; the screen reports nothing. */
    readonly on: Record<never, never>
}

/** Draw the task screen; the block owns the workspace chrome, the query and the mutations. */
export const TasksPageBase = (props: TasksPageBaseProps) => {
    void props
    return <TaskListBlock {...{}} />
}
