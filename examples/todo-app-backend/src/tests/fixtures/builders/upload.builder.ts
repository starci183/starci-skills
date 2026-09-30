import { builder } from "@starci/jest-preset"
import type { TaskView } from "@modules/domain/task"

/** The columns of a stored row, declared here so a spec never reaches into the persistence of the owner. */
export interface UploadRow {
    id: string
    owner: string
    taskId: string | null
    filename: string
    mime: string
    sizeBytes: number
    storageKey: string
    status: string
    createdAt: Date
}

/** The instant the upload specs run at. */
export const UPLOAD_AT = "2026-09-10T10:00:00.000Z"

/** The secret the upload specs sign presign tokens with. */
export const UPLOAD_SECRET = "test-signing-secret"

/** A pending, unattached 5-byte text upload of p-1; override the status or task a spec is about. */
export const uploadRow = builder<UploadRow>({
    id: "u-1",
    owner: "p-1",
    taskId: null,
    filename: "note.txt",
    mime: "text/plain",
    sizeBytes: 5,
    storageKey: "uploads/u-1",
    status: "pending",
    createdAt: new Date("2026-09-10T09:00:00.000Z"),
})

/** The open task t-1 of p-1 that uploads attach to. */
export const uploadTask = builder<TaskView>({ id: "t-1", owner: "p-1", title: "Write", complete: false, completedAt: null })
