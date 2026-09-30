import { UploadErrorCode } from "@modules/domain/upload"
import { UploadStorageError, UploadStorageErrorCode } from "@modules/integrations/upload"
import { toStorageRefusal } from "./upload-storage-refusal.mapper"

describe("toStorageRefusal", () => {
    it("turns a failure of the storage integration into the storage-unavailable refusal of the upload", () => {
        const failure = new UploadStorageError({ code: UploadStorageErrorCode.Failed })
        expect(toStorageRefusal(failure, "u1")).toEqual({
            kind: "refused",
            code: UploadErrorCode.StorageUnavailable,
            params: { uploadId: "u1" },
        })
    })

    it("answers null for any other failure so the handler rethrows it", () => {
        expect(toStorageRefusal(new TypeError("bug"), "u1")).toBeNull()
        expect(toStorageRefusal("boom", "u1")).toBeNull()
    })
})
