import { EnvSource } from "@modules/platform/config"
import { parseUploadStorageConfig } from "./upload.config"

describe("parseUploadStorageConfig", () => {
    it("reads the storage directory", () => {
        expect(parseUploadStorageConfig(new EnvSource({ UPLOAD_DIR: "/var/uploads" }))).toEqual({ directory: "/var/uploads" })
    })

    it("has no default directory", () => {
        expect(() => parseUploadStorageConfig(new EnvSource({}))).toThrow()
    })
})
