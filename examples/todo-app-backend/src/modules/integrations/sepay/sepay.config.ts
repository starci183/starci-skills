import {
    AppConfigService,
} from "@modules/platform/config/index"

/** The SePay gateway settings: base URL, API key and webhook secret (the last two are empty when no decrypted file is named). */
export interface SepayConfig {
    readonly baseUrl: string
    readonly apiKey: string
    readonly webhookSecret: string
}

/** Reads the sepay settings through the platform config reader on every access, so a value changed in the environment is never cached here. */
export const sepayConfig = (source: AppConfigService): SepayConfig => ({
    get baseUrl(): string {
        return source.getSepayBaseUrl()
    },
    get apiKey(): string {
        return source.getSepayApiKey()
    },
    get webhookSecret(): string {
        return source.getSepayWebhookSecret()
    },
})
