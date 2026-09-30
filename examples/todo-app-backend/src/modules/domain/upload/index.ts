import { UploadEntity } from "./persistence/entities/upload.entity"
import { CreateUploadsTable1758300000000 } from "./persistence/migrations/1758300000000-create-uploads-table"

/** The entities of the upload capability, for the connection that holds them. */
export const uploadEntities = [UploadEntity]

/** The migrations of the upload capability, in the order they run. */
export const uploadMigrations = [CreateUploadsTable1758300000000]

export { UPLOAD_ERROR_KINDS, UploadError, UploadErrorCode } from "./errors/upload.error"
export { UPLOAD_MESSAGES } from "./messages/upload.messages"
export { parseUploadConfig } from "./upload.config"
export { UPLOAD_TOKEN_HEADER } from "./upload.contracts"
export type { UploadStatus, UploadView } from "./upload.contracts"
export { UploadModule } from "./upload.module"
export type { UploadOptions } from "./upload.options"
export { UploadService } from "./upload.service"
