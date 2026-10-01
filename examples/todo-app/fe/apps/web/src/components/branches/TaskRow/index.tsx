import { useEffect, useRef, useState } from "react"
import { Button, Checkbox, Text, TextAction } from "@starci/grammar/common"
import { recurHref, taskShareHref } from "@/modules/routes"
import type { Task } from "@/modules/types"
import {
    TASK_ROW_ACTIONS_CLASS_NAME,
    TASK_ROW_CLASS_NAME,
    TASK_ROW_CONFIRM_CLASS_NAME,
    TASK_ROW_LABEL_CLASS_NAME,
} from "./classNames"

/** Every word one task row renders, resolved by the connected half. */
type TaskRowCopy = {
    readonly formatDeleteConfirm: (title: string) => string
    readonly delete: string
    readonly cancel: string
    readonly share: string
    readonly schedule: string
}

/** One row's contract: the task, its words, whether a delete is in flight and the two intents. */
export type TaskRowProps = {
    readonly task: Task
    readonly copy: TaskRowCopy
    readonly isDeleting: boolean
    readonly onToggleComplete: (id: string, complete: boolean) => void
    readonly onDelete: (id: string) => void
}

/**
 * One task: its completion toggle and title, and the row's actions - share, schedule and a delete that
 * asks for confirmation inline. A dismissed confirmation hands focus back to the Delete action that
 * opened it, once the row's own actions have rendered again.
 */
export const TaskRow = (props: TaskRowProps) => {
    const { task, copy } = props
    const [confirming, setConfirming] = useState(false)
    const actions = useRef<HTMLDivElement>(null)
    const returnFocus = useRef(false)

    useEffect(() => {
        if (confirming || !returnFocus.current) return
        returnFocus.current = false
        actions.current?.querySelector("button")?.focus()
    }, [confirming])

    const onCancelDelete = () => {
        returnFocus.current = true
        setConfirming(false)
    }

    return (
        <div role="listitem" className={TASK_ROW_CLASS_NAME}>
            <div className={TASK_ROW_LABEL_CLASS_NAME}>
                <Checkbox
                    isSelected={task.complete}
                    onSelectedChange={(complete) => props.onToggleComplete(task.id, complete)}
                    label={
                        <Text
                            as="span"
                            tone={task.complete ? "muted" : "default"}
                            isSuperseded={task.complete}
                            overflow="truncate"
                        >
                            {task.title}
                        </Text>
                    }
                />
            </div>
            <div ref={actions} className={confirming ? TASK_ROW_CONFIRM_CLASS_NAME : TASK_ROW_ACTIONS_CLASS_NAME}>
                {confirming ? (
                    <>
                        <Text as="span" size="sm">
                            {copy.formatDeleteConfirm(task.title)}
                        </Text>
                        <Button
                            type="button"
                            variant="danger"
                            isDisabled={props.isDeleting}
                            onPress={() => props.onDelete(task.id)}
                        >
                            {copy.delete}
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            isDisabled={props.isDeleting}
                            onPress={onCancelDelete}
                        >
                            {copy.cancel}
                        </Button>
                    </>
                ) : (
                    <>
                        <TextAction appearance="inline" href={taskShareHref(task.id)}>
                            {copy.share}
                        </TextAction>
                        <TextAction appearance="inline" href={recurHref(task.title)}>
                            {copy.schedule}
                        </TextAction>
                        <Button type="button" variant="danger-soft" onPress={() => setConfirming(true)}>
                            {copy.delete}
                        </Button>
                    </>
                )}
            </div>
        </div>
    )
}
