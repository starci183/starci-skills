import type { AcceptUploadContentRequest } from "../../application/accept-upload-content.contracts"
import type { CreateDirectUploadRequest } from "../../application/create-direct-upload.contracts"
import type { ReadUploadContentRequest } from "../../application/read-upload-content.contracts"
import type { DirectUploadRequest, UploadContentRequest } from "./dto/upload.request"

/** The media type of a content-type header: the part before any parameter, or empty when there is none. */
const mediaTypeOf = (contentType: string | undefined): string => (contentType ?? "").split(";")[0]?.trim() ?? ""

/** Maps the direct upload request: the content type of the request is the declared media type. */
export const toDirectUploadRequest = (
    query: DirectUploadRequest,
    contentType: string | undefined,
    content: Buffer,
): CreateDirectUploadRequest => ({ filename: query.filename ?? "file", mime: mediaTypeOf(contentType), content })

/** Maps the presigned content request: the token header is the credential. */
export const toAcceptUploadContentRequest = (
    params: UploadContentRequest,
    token: string | undefined,
    content: Buffer,
): AcceptUploadContentRequest => ({ uploadId: params.uploadId, token, content })

/** Maps the download request. */
export const toReadUploadContentRequest = (params: UploadContentRequest): ReadUploadContentRequest => ({
    uploadId: params.uploadId,
})
