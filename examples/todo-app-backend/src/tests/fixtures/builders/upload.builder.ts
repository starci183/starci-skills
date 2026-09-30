import { Secret } from "@modules/platform/config"
import { builder } from "@starci/jest-preset"
import type { UploadOptions, UploadRow } from "@modules/domain/upload"
import type { TaskView } from "@modules/domain/task"

/** The instant the upload specs run at. */
export const UPLOAD_AT = "2026-09-10T10:00:00.000Z"

/** The secret the upload specs sign presign tokens with. */
export const UPLOAD_SECRET = "test-signing-secret"

/** The upload options: 1000 bytes at most, text and png only, a one minute presign window. */
export const uploadOptions = builder<UploadOptions>({
    maxBytes: 1000,
    allowedMimes: ["text/plain", "image/png"],
    presignTtlMs: 60_000,
    signingSecret: new Secret(UPLOAD_SECRET),
})

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
