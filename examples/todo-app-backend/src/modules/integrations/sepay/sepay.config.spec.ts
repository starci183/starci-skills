import {
    AppConfigService,
} from "@modules/platform/config/index"
import {
    sepayConfig,
} from "./sepay.config"

describe("sepay config",
    () => {
        it("reads every setting through the platform config reader at access time",
            () => {
                const source = {
                    getSepayBaseUrl: jest.fn().mockReturnValue("https://pay.test"),
                    getSepayApiKey: jest.fn().mockReturnValue("key"),
                    getSepayWebhookSecret: jest.fn().mockReturnValue("hook"),
                } as unknown as AppConfigService
                const config = sepayConfig(source)

                expect(config.baseUrl).toEqual("https://pay.test")
                expect(config.apiKey).toEqual("key")
                expect(config.webhookSecret).toEqual("hook")
                expect(source.getSepayBaseUrl).toHaveBeenCalledTimes(1)
                expect(source.getSepayApiKey).toHaveBeenCalledTimes(1)
                expect(source.getSepayWebhookSecret).toHaveBeenCalledTimes(1)
            })
    })
