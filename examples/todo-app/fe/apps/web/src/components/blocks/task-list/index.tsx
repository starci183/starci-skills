"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import type { TaskCollectionState } from "@/components/composites/TaskCollection"
import { useSignOut } from "@/hooks/auth"
import { useAccountShellCopy } from "@/hooks/shell"
import { useTasks, useCreateTask, useSetTaskComplete, useDeleteTask } from "@/hooks/task"
import { TaskListView } from "./component"

/** The task list takes nothing from its page: it owns its own session gate and task query. */
type TaskListBlockProps = Record<never, never>

/** Which of the four shapes the query result settles on: refused, empty, one task or many. */
const stateOf = (hasError: boolean, taskCount: number): TaskCollectionState => {
    if (hasError) return "refused"
    if (taskCount === 0) return "empty"
    return taskCount === 1 ? "one-task" : "many-tasks"
}

/**
 * The connected owner of ui.task.list: it owns the tasks query, the three mutations and the new-task
 * draft as intrinsic form state, resolves the one state the collection renders, and hands every render
 * path to the pure TaskListView in ./component.tsx, resolved from the `tasks` message namespace.
 */
export const TaskListBlock = (props: TaskListBlockProps) => {
    void props
    const t = useTranslations("tasks")
    const shellCopy = useAccountShellCopy("tasks")
    const onSignOut = useSignOut()
    const [newTitle, setNewTitle] = useState("")
    const tasksQuery = useTasks()
    const createTask = useCreateTask()
    const setTaskComplete = useSetTaskComplete()
    const deleteTask = useDeleteTask()

    const refusal = tasksQuery.error ? t("sessionEnded") : null

    const onCreate = () => {
        const title = newTitle.trim()
        if (!title) return
        void createTask.trigger({ title }, { throwOnError: false }).then((created) => {
            if (created === undefined) return
            setNewTitle("")
            void tasksQuery.mutate()
        })
    }

    return (
        <TaskListView
            copy={{ ...shellCopy, heading: t("heading"), tagline: t("tagline") }}
            collection={{
                state: stateOf(Boolean(tasksQuery.error), tasksQuery.data?.length ?? 0),
                tasks: tasksQuery.data ?? [],
                refusal,
                newTitle,
                isCreating: createTask.isMutating,
                isDeleting: deleteTask.isMutating,
                copy: {
                    newTaskLabel: t("newTaskLabel"),
                    newTaskPlaceholder: t("newTaskPlaceholder"),
                    addTask: t("addTask"),
                    allTasks: t("allTasks"),
                    formatTaskCount: (count: number) => t("taskCount", { count }),
                    empty: t("empty"),
                    mascotAlt: t("mascotAlt"),
                    formatDeleteConfirm: (title: string) => t("deleteConfirm", { title }),
                    delete: t("delete"),
                    cancel: t("cancel"),
                    share: t("share"),
                    schedule: t("schedule"),
                    completedNote: t("completedNote"),
                },
                onNewTitleChange: setNewTitle,
                onCreate,
                onToggleComplete: (id, complete) => {
                    void setTaskComplete.trigger({ id, complete }, { throwOnError: false }).then((updated) => {
                        if (updated !== undefined) void tasksQuery.mutate()
                    })
                },
                onDelete: (id) => {
                    void deleteTask.trigger({ id }, { throwOnError: false }).then((deleted) => {
                        if (deleted !== undefined) void tasksQuery.mutate()
                    })
                },
            }}
            onSignOut={onSignOut}
        />
    )
}
