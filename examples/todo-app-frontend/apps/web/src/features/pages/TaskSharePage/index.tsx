import { TaskSharePageBase } from "./component"

/** The public props of the share route: the task the `[taskId]` segment names. */
type TaskSharePageProps = { readonly taskId: string }

/** The share route's connected half: it hands the task the segment names down to the screen. */
export const TaskSharePage = (props: TaskSharePageProps) => (
    <TaskSharePageBase state="ready" props={{ taskId: props.taskId }} on={{}} />
)
