import axios from "axios"
import type { AxiosInstance } from "axios"
import { restUrl } from "@/modules/config"

/** How long one REST call may run before axios aborts it. */
const REST_TIMEOUT_MS = 30_000

let instance: AxiosInstance | undefined

/**
 * The one axios instance of the app, for what GraphQL cannot carry: uploads, presigned URLs and auth endpoints. Every call
 * under modules/api/rest/<area>/ goes through it and passes its own abort signal. Created on first use, so a page that never
 * calls REST never needs `NEXT_PUBLIC_REST_URL`.
 */
export const restClient = (): AxiosInstance =>
    (instance ??= axios.create({ baseURL: restUrl(), timeout: REST_TIMEOUT_MS }))
