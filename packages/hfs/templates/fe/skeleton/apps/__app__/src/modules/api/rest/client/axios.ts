import axios from "axios"
import type { AxiosInstance } from "axios"
import { restUrl } from "@/modules/config"

/** How long one REST call may run before axios aborts it. */
const REST_TIMEOUT_MS = 30_000

/**
 * The one axios instance of the app, for what GraphQL cannot carry: uploads, presigned URLs and auth endpoints. Every call
 * under modules/api/rest/<area>/ goes through it and passes its own abort signal. Its base is read per request, so a page
 * that never calls REST never needs `NEXT_PUBLIC_REST_URL`. It holds no credential or per-reader state.
 */
export const restClient: AxiosInstance = axios.create({ timeout: REST_TIMEOUT_MS })

restClient.interceptors.request.use((config) => ({ ...config, baseURL: restUrl() }))
