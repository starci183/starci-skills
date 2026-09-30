import type { UploadStatus, UploadView } from "../upload.contracts"
import type { UploadEntity } from "./entities/upload.entity"

/** The lifecycle a stored status text names; anything but ready is still pending. */
const toUploadStatus = (status: string): UploadStatus => (status === "ready" ? "ready" : "pending")

/** Maps an upload row to the view callers get. */
export const toUploadView = (row: UploadEntity): UploadView => ({
    id: row.id,
    owner: row.owner,
    taskId: row.taskId,
    filename: row.filename,
    mime: row.mime,
    sizeBytes: row.sizeBytes,
    storageKey: row.storageKey,
    status: toUploadStatus(row.status),
    createdAt: row.createdAt,
})
