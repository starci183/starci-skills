import type { TaskUploads, UploadErrorCode } from "@modules/domain/upload"
import type { Outcome } from "@modules/platform/primitives"

/** What listing the uploads of a task takes: the task. */
export interface ListTaskUploadsRequest {
    /** The task; it must be owned by the caller. */
    readonly taskId: string
}

/** The attachments, or the refusal that names why the caller may not list them. */
export type ListTaskUploadsResult = Outcome<TaskUploads, UploadErrorCode>
