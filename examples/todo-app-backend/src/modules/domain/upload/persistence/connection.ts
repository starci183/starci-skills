import { UploadEntity } from "./entities/upload.entity"
import { CreateUploadsTable1758300000000 } from "./migrations/1758300000000-create-uploads-table"

/** The entities of the upload capability, for the connection that holds them. */
export const uploadEntities = [UploadEntity]

/** The migrations of the upload capability, in the order they run. */
export const uploadMigrations = [CreateUploadsTable1758300000000]
