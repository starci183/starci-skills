import {
    AppConfigService,
} from "@modules/platform/config/index"
import {
    notifyQueueConfig,
} from "./notify-queue.config"

describe("notify-queue config",
    () => {
        it("reads every setting through the platform config reader at access time",
            () => {
                const source = {
                    getRedisUrl: jest.fn().mockReturnValue("redis://queue.test:6379"),
                } as unknown as AppConfigService
                const config = notifyQueueConfig(source)

                expect(config.redisUrl).toEqual("redis://queue.test:6379")
                expect(source.getRedisUrl).toHaveBeenCalledTimes(1)
            })
    })
