import type { ListTaskUploadsRequest, TaskUploads } from "../../application/list-task-uploads.contracts"
import type { TaskUploadsInput } from "./dto/task-uploads.input"
import type { UploadType } from "./dto/upload.type"
import { toUploadType } from "./upload.mapper"

/** Maps the GraphQL input to the query request. */
export const toTaskUploadsRequest = (input: TaskUploadsInput): ListTaskUploadsRequest => ({ taskId: input.taskId })

/** Maps the attachments of a task to the GraphQL list. */
export const toTaskUploadsTypes = (listed: TaskUploads): Array<UploadType> => listed.uploads.map(toUploadType)
