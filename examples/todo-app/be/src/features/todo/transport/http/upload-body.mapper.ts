/**
 * The raw bytes the raw-body middleware of the upload routes put on the request, or no bytes when the request carries
 * no such body (for example a JSON body that another parser already consumed), which the intake rules refuse as an empty file.
 */
export const toUploadBody = (body: unknown): Buffer => (Buffer.isBuffer(body) ? body : Buffer.alloc(0))
