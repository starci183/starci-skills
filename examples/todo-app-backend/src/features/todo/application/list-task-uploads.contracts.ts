import type { UploadErrorCode } from "@modules/domain/upload"
import type { Outcome } from "@modules/platform/primitives"
import type { UploadSummary } from "./support/upload-summary.contracts"

/** What listing the uploads of a task takes: the task. */
export interface ListTaskUploadsRequest {
    /** The task; it must be owned by the caller. */
    readonly taskId: string
}

/** The uploads attached to the task. */
export interface TaskUploads {
    /** The attachments of the caller on the task. */
    readonly uploads: ReadonlyArray<UploadSummary>
}

/** The attachments, or the refusal that names why the caller may not list them. */
export type ListTaskUploadsResult = Outcome<TaskUploads, UploadErrorCode>
