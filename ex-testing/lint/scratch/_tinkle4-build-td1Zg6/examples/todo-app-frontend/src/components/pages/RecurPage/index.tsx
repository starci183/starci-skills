"use client"

import { useSearchParams } from "next/navigation"

import { RecurPageBase } from "./component"

/** The public props of the recur schedule route: the route hands it nothing. */
export type RecurPageProps = Record<never, never>

/**
 * The recur route's connected half; it reads the task the query names and hands it down.
 *
 * ui.recur.schedule's surface route is the task's own schedule; the example backend's
 * makeRecurring contract identifies the task by its title (there is no taskId-to-rule lookup),
 * so the route binds it as `?task=<title>` rather than inventing an id the API cannot resolve.
 */
export const RecurPage = (props: RecurPageProps) => {
    void props
    const task = useSearchParams().get("task")
    const taskTitle = task === null || task === "" ? null : task
    return <RecurPageBase state="ready" props={{ taskTitle }} on={{}} />
}
