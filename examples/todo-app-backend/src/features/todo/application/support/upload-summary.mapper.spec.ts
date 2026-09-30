import { toUploadSummary } from "./upload-summary.mapper"

const CREATED = new Date("2026-09-30T10:00:00.000Z")

describe("toUploadSummary", () => {
    it("keeps the public columns and drops the owner and the storage key", () => {
        const summary = toUploadSummary({
            id: "u1",
            owner: "p1",
            taskId: "t1",
            filename: "note.txt",
            mime: "text/plain",
            sizeBytes: 3,
            storageKey: "uploads/u1",
            status: "ready",
            createdAt: CREATED,
        })
        expect(summary).toEqual({
            uploadId: "u1",
            taskId: "t1",
            filename: "note.txt",
            mime: "text/plain",
            sizeBytes: 3,
            status: "ready",
            createdAt: CREATED,
        })
    })
})
