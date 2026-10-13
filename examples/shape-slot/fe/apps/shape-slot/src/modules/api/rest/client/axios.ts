import axios from "axios"
import type { AxiosInstance } from "axios"
import { appConfig } from "@/modules/config"

/**
 * The one axios instance of the app: every call under modules/api/rest/<area>/ goes through it with its own abort signal.
 * Its base is the configured sales API origin (modules/config reads it when the app loads) and every request is abandoned
 * after the configured timeout. A failed call rejects with the AxiosError, whose `status` (403 for a refusal, absent for a
 * network failure) is what a slot reads. It holds no credential or per-reader state.
 */
export const restClient: AxiosInstance = axios.create({
    baseURL: appConfig.apiBaseUrl,
    timeout: appConfig.requestTimeoutMs,
})
