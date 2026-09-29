import {
    AppConfigService,
} from "@modules/platform/config/index"
import {
    notifySmtpConfig,
} from "./notify-smtp.config"
import {
    mock 
} from "@starci/jest-preset/mock"

describe("notify-smtp config",
    () => {
        it("reads every setting through the platform config reader at access time",
            () => {
                const source = mock<AppConfigService>({
                    getSmtpHost: jest.fn().mockReturnValue("smtp.test"),
                    getSmtpPort: jest.fn().mockReturnValue(2525),
                    getSmtpFromAddress: jest.fn().mockReturnValue("notify@todo.test"),
                })
                const config = notifySmtpConfig(source)

                expect(config.host).toEqual("smtp.test")
                expect(config.port).toEqual(2525)
                expect(config.fromAddress).toEqual("notify@todo.test")
                expect(source.getSmtpHost).toHaveBeenCalledTimes(1)
                expect(source.getSmtpPort).toHaveBeenCalledTimes(1)
                expect(source.getSmtpFromAddress).toHaveBeenCalledTimes(1)
            })
    })
