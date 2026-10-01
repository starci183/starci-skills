import type { AttachUploadRequest } from "../../application/attach-upload.contracts"
import type { AttachUploadInput } from "./dto/attach-upload.input"

/** Maps the GraphQL input to the command request. */
export const toAttachUploadRequest = (input: AttachUploadInput): AttachUploadRequest => ({
    uploadId: input.uploadId,
    taskId: input.taskId,
})
