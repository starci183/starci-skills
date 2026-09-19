import { TasksPageBase } from "./component"

/** The public props of the tasks route: the route hands it nothing. */
export type TasksPageProps = Record<never, never>

/**
 * The tasks route's connected half. The screen it mounts is session-gated - it renders nothing
 * until a token exists in the browser - so the page's whole situation space is "ready": the
 * loading a reader watches for belongs to the feature, not to this surface.
 */
export const TasksPage = (props: TasksPageProps) => {
    void props
    return <TasksPageBase state="ready" props={{}} on={{}} />
}
