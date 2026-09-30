/** The answer of the upload doors that store bytes: the upload as the caller may see it. */
export interface UploadResponse {
    /** The upload id. */
    readonly uploadId: string
    /** The task the upload is attached to, null while it is unattached. */
    readonly taskId: string | null
    /** The file name. */
    readonly filename: string
    /** The media type. */
    readonly mime: string
    /** The size in bytes. */
    readonly sizeBytes: number
    /** The lifecycle: pending until the bytes land, then ready. */
    readonly status: string
    /** When the upload row was created, as an ISO-8601 instant. */
    readonly createdAt: string
}
