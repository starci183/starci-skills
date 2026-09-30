import { UploadScanClient } from "./upload-scan.client"

describe("UploadScanClient", () => {
    it("accepts every object: the shipped scan is an explicit pass-through", async () => {
        await expect(new UploadScanClient().scan()).resolves.toEqual({ accepted: true })
    })
})
