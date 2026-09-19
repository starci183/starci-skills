import { TasksPage as TasksFeaturePage } from "@/features/pages/tasks"

/** Props for {@link TasksPageBase}. */
export type TasksPageProps = {
    /** Whole-screen situations this surface settles; today the route is always ready - the feature owns its own session loading. */
    readonly state: "ready"
    /** The data payload for whatever state is showing; the screen wants nothing from the route. */
    readonly props: Record<never, never>
    /** What the surface reports upward; the screen reports nothing. */
    readonly on: Record<never, never>
}

/**
 * Draw the tasks screen. The feature entry owns the list, its session gate, and its mutations;
 * this twin exists to hold the page's one situation honestly rather than to decorate it.
 */
export const TasksPageBase = (props: TasksPageProps) => {
    void props
    return <TasksFeaturePage />
}
