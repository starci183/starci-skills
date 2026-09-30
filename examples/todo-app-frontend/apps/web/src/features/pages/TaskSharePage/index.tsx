"use client"

import { useParams } from "next/navigation"
import { TaskSharePageBase } from "./component"

/**
 * The share route's connected entry and client boundary: it reads the task the `[taskId]` segment
 * names and hands it down. The segment always resolves - it exists because the route matched.
 */
export const TaskSharePage = () => {
    const { taskId } = useParams<{ readonly taskId: string }>()
    return <TaskSharePageBase taskId={taskId} />
}
