import Image from "next/image"
import { Button, Form, Input, MediaFrame, SectionHeader, Text } from "@starci/grammar/common"
import { TaskRow, type TaskRowProps } from "@/components/branches/TaskRow"
import type { Task } from "@/modules/types"
import {
    TASK_LIST_BODY_CLASS_NAME,
    TASK_LIST_EMPTY_CLASS_NAME,
    TASK_LIST_FIELD_CLASS_NAME,
    TASK_LIST_FORM_CLASS_NAME,
    TASK_LIST_MASCOT_FRAME_CLASS_NAME,
    TASK_LIST_ROWS_CLASS_NAME,
    TASK_LIST_SECTION_CLASS_NAME,
} from "./classNames"

/** The brand turtle master, served from `public/`; it is square. */
const TURTLE_MASTER_SRC = "/turtle-master.png"
const TURTLE_MASTER_SIDE = 1254

/**
 * ui.task.list states: empty, one-task, many-tasks, refused. A state this record does not name has no
 * branch here; the connected owner in the task-list block resolves which state applies and hands it
 * down explicitly - this view never re-derives it from the query result.
 */
export type TaskCollectionState = "empty" | "one-task" | "many-tasks" | "refused"

/** Every word the task collection renders, resolved by the connected half. The formatters carry the
 * numbers only the view knows - the row tally and the title of the row under confirmation. */
type TaskCollectionCopy = TaskRowProps["copy"] & {
    readonly newTaskLabel: string
    readonly newTaskPlaceholder: string
    readonly addTask: string
    readonly allTasks: string
    readonly formatTaskCount: (count: number) => string
    readonly empty: string
    readonly mascotAlt: string
    readonly completedNote: string
}

/** The public props of the task collection. */
export type TaskCollectionProps = {
    readonly state: TaskCollectionState
    readonly tasks: ReadonlyArray<Task>
    readonly refusal: string | null
    readonly newTitle: string
    readonly isCreating: boolean
    readonly isDeleting: boolean
    readonly copy: TaskCollectionCopy
    readonly onNewTitleChange: (value: string) => void
    readonly onCreate: () => void
    readonly onToggleComplete: (id: string, complete: boolean) => void
    readonly onDelete: (id: string) => void
}

/**
 * The pure render of ui.task.list's collection: the create form and the rows. Every one of the four
 * states is decided by the caller's `state`, and every word it draws arrives resolved through `copy`.
 */
export const TaskCollection = (props: TaskCollectionProps) => {
    const copy = props.copy
    const state = props.state

    const onCreate = () => {
        /* fr.task.create refuses an empty title at submit, so the primary action stays the direction's
         * full-accent button at rest instead of a disabled control the direction never drew. */
        if (!props.newTitle.trim()) return
        props.onCreate()
    }

    const taskCount = props.tasks.length

    return (
        <div data-state={state} className={TASK_LIST_BODY_CLASS_NAME}>
            {state === "refused" ? (
                <Text live="assertive">{props.refusal}</Text>
            ) : (
                <>
                    <Form label={copy.newTaskLabel} onSubmit={onCreate}>
                        <div className={TASK_LIST_FORM_CLASS_NAME}>
                            <div className={TASK_LIST_FIELD_CLASS_NAME}>
                                <Input
                                    id="new-task-title"
                                    name="title"
                                    label={copy.newTaskLabel}
                                    placeholder={copy.newTaskPlaceholder}
                                    value={props.newTitle}
                                    onValueChange={props.onNewTitleChange}
                                />
                            </div>
                            <Button
                                type="submit"
                                variant="primary"
                                isDisabled={props.isCreating}
                                isPending={props.isCreating}
                            >
                                {copy.addTask}
                            </Button>
                        </div>
                    </Form>
                    <div role="region" aria-labelledby="all-tasks-heading" className={TASK_LIST_SECTION_CLASS_NAME}>
                        <SectionHeader
                            level={2}
                            id="all-tasks-heading"
                            title={copy.allTasks}
                            meta={taskCount > 0 ? copy.formatTaskCount(taskCount) : undefined}
                        />
                        {state === "empty" ? (
                            <div className={TASK_LIST_EMPTY_CLASS_NAME}>
                                <MediaFrame
                                    aspect="square"
                                    fit="contain"
                                    treatment="plain"
                                    className={TASK_LIST_MASCOT_FRAME_CLASS_NAME}
                                >
                                    <Image
                                        src={TURTLE_MASTER_SRC}
                                        alt={copy.mascotAlt}
                                        width={TURTLE_MASTER_SIDE}
                                        height={TURTLE_MASTER_SIDE}
                                        sizes="10rem"
                                    />
                                </MediaFrame>
                                <Text tone="muted">{copy.empty}</Text>
                            </div>
                        ) : (
                            <>
                                <div role="list" className={TASK_LIST_ROWS_CLASS_NAME}>
                                    {props.tasks.map((task) => (
                                        <TaskRow
                                            key={task.id}
                                            task={task}
                                            copy={copy}
                                            isDeleting={props.isDeleting}
                                            onToggleComplete={props.onToggleComplete}
                                            onDelete={props.onDelete}
                                        />
                                    ))}
                                </div>
                                <Text tone="muted" size="sm">
                                    {copy.completedNote}
                                </Text>
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
