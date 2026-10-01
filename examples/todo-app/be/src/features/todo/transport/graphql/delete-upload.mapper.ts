import type { DeletedUpload } from "@modules/domain/upload"
import type { DeleteUploadRequest } from "../../application/delete-upload.contracts"
import type { DeleteUploadInput } from "./dto/delete-upload.input"
import type { DeleteUploadType } from "./dto/delete-upload.type"

/** Maps the GraphQL input to the command request. */
export const toDeleteUploadRequest = (input: DeleteUploadInput): DeleteUploadRequest => ({ uploadId: input.uploadId })

/** Maps the confirmation to the GraphQL type. */
export const toDeleteUploadType = (deleted: DeletedUpload): DeleteUploadType => ({
    uploadId: deleted.uploadId,
    deleted: deleted.deleted,
})
