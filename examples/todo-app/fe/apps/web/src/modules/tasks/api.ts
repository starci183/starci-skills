import { isRecord, parseList, parseOutcome, request, unwrap } from "@/modules/api"
import type { Task } from "@/modules/types"

/** One task of the wire, or `null` when the row is not the shape the backend promises. */
const toTask = (row: unknown): Task | null =>
    isRecord(row) &&
    typeof row.taskId === "string" &&
    typeof row.title === "string" &&
    typeof row.complete === "boolean"
        ? { id: row.taskId, title: row.title, complete: row.complete }
        : null

/** The list of tasks of a payload. */
const toTasks = (data: unknown): ReadonlyArray<Task> | null => parseList(data, toTask)

/** A created task: its identity and title, never complete. */
const toCreatedTask = (data: unknown): Task | null =>
    isRecord(data) && typeof data.taskId === "string" && typeof data.title === "string"
        ? { id: data.taskId, title: data.title, complete: false }
        : null

/** The complete flag a complete/reopen payload settled on, keyed by the task it names. */
const toCompletion = (data: unknown): Task | null =>
    isRecord(data) && typeof data.taskId === "string" && typeof data.complete === "boolean"
        ? { id: data.taskId, title: "", complete: data.complete }
        : null

/** Whether a delete payload says the row is gone. */
const toDeleted = (data: unknown): boolean | null =>
    isRecord(data) && typeof data.deleted === "boolean" ? data.deleted : null

/** Reads the viewer's own tasks; a missing or expired token surfaces as a thrown refusal. */
export const listTasks = async (token: string): Promise<ReadonlyArray<Task>> =>
    unwrap(parseOutcome(await request({ operation: "ListTasks", token }), toTasks))

/** Creates one task from its trimmed title. */
export const createTask = async (token: string, title: string): Promise<Task> =>
    unwrap(
        parseOutcome(await request({ operation: "CreateTask", variables: { input: { title } }, token }), toCreatedTask),
    )

/**
 * Sets one task's complete flag (br.task.complete.once: completing twice is a no-op; reopening clears
 * the completion timestamp). The backend exposes these as two separate mutations - `completeTask` and
 * `reopenTask`, neither taking a flag - so this is the one place that turns the boolean the callers
 * pass into the right document.
 */
export const setTaskComplete = async (token: string, id: string, complete: boolean): Promise<Task> =>
    unwrap(
        parseOutcome(
            await request({ operation: complete ? "CompleteTask" : "ReopenTask", variables: { id }, token }),
            toCompletion,
        ),
    )

/** Deletes one task permanently (br.task.delete.final: there is no undo); answers whether the row is gone. */
export const deleteTask = async (token: string, id: string): Promise<boolean> =>
    unwrap(parseOutcome(await request({ operation: "DeleteTask", variables: { id }, token }), toDeleted))
