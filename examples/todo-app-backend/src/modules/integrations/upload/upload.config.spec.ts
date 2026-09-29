import {
    AppConfigService,
} from "@modules/platform/config/index"
import {
    uploadConfig,
} from "./upload.config"

describe("upload config",
    () => {
        it("reads every setting through the platform config reader at access time",
            () => {
                const source = {
                    getUploadStorageDir: jest.fn().mockReturnValue("/data/uploads"),
                    getUploadMaxBytes: jest.fn().mockReturnValue(1024),
                    getUploadAllowedMimes: jest.fn().mockReturnValue(["text/plain"]),
                    getUploadSigningSecret: jest.fn().mockReturnValue("sign"),
                    getUploadPresignTtlMs: jest.fn().mockReturnValue(60000),
                } as unknown as AppConfigService
                const config = uploadConfig(source)

                expect(config.storageDir).toEqual("/data/uploads")
                expect(config.maxBytes).toEqual(1024)
                expect(config.allowedMimes).toEqual(["text/plain"])
                expect(config.signingSecret).toEqual("sign")
                expect(config.presignTtlMs).toEqual(60000)
                expect(source.getUploadStorageDir).toHaveBeenCalledTimes(1)
                expect(source.getUploadMaxBytes).toHaveBeenCalledTimes(1)
                expect(source.getUploadAllowedMimes).toHaveBeenCalledTimes(1)
                expect(source.getUploadSigningSecret).toHaveBeenCalledTimes(1)
                expect(source.getUploadPresignTtlMs).toHaveBeenCalledTimes(1)
            })
    })
