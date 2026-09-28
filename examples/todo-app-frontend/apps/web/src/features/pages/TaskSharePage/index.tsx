"use client"

import { useParams } from "next/navigation"

import { TaskSharePageBase } from "./component"

/** The public props of the share route: the route hands it nothing. */
export type TaskSharePageProps = Record<never, never>

/**
 * The share route's connected half; it reads the task the segment names and hands it down. The
 * segment always resolves - `[taskId]` exists because the route matched - so the page's whole
 * situation space is "ready".
 */
export const TaskSharePage = (props: TaskSharePageProps) => {
    void props
    const { taskId } = useParams<{ readonly taskId: string }>()
    return <TaskSharePageBase state="ready" props={{ taskId }} on={{}} />
}
