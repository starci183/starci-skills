import type { CreateUploadIntentRequest, UploadIntent } from "../../application/create-upload-intent.contracts"
import type { CreateUploadIntentInput } from "./dto/create-upload-intent.input"
import type { CreateUploadIntentType } from "./dto/create-upload-intent.type"

/** Maps the GraphQL input to the command request. */
export const toCreateUploadIntentRequest = (input: CreateUploadIntentInput): CreateUploadIntentRequest => ({
    filename: input.filename,
    mime: input.mime,
    sizeBytes: input.sizeBytes,
})

/** Maps the presigned intent to the GraphQL type; the expiry travels as an ISO instant. */
export const toCreateUploadIntentType = (intent: UploadIntent): CreateUploadIntentType => ({
    uploadId: intent.uploadId,
    method: intent.method,
    url: intent.url,
    headers: intent.headers.map((header) => ({ name: header.name, value: header.value })),
    expiresAt: intent.expiresAt.toISOString(),
})
