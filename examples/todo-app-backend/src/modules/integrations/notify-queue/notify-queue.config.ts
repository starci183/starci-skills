import {
    AppConfigService,
} from "@modules/platform/config/index"

/** The notify queue settings: the Redis URL the queue client connects to. */
export interface NotifyQueueConfig {
    readonly redisUrl: string
}

/** Reads the notify-queue settings through the platform config reader on every access, so a value changed in the environment is never cached here. */
export const notifyQueueConfig = (source: AppConfigService): NotifyQueueConfig => ({
    get redisUrl(): string {
        return source.getRedisUrl()
    },
})
