/**
 * The raw bytes the raw-body middleware of the upload routes put on the request, or null when the request carries no
 * such body (for example a JSON body that another parser already consumed).
 */
export const toUploadBody = (body: unknown): Buffer | null => (Buffer.isBuffer(body) ? body : null)
