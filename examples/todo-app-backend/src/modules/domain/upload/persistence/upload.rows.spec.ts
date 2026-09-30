import type { UploadEntity } from "./entities/upload.entity"
import { toUploadView } from "./upload.rows"

const CREATED = new Date("2026-09-30T10:00:00.000Z")

const row = (status: string): UploadEntity => ({
    id: "u1",
    owner: "p1",
    taskId: null,
    filename: "note.txt",
    mime: "text/plain",
    sizeBytes: 3,
    storageKey: "uploads/u1",
    status,
    createdAt: CREATED,
})

describe("toUploadView", () => {
    it("maps every column of a ready row", () => {
        expect(toUploadView(row("ready"))).toEqual({
            id: "u1",
            owner: "p1",
            taskId: null,
            filename: "note.txt",
            mime: "text/plain",
            sizeBytes: 3,
            storageKey: "uploads/u1",
            status: "ready",
            createdAt: CREATED,
        })
    })

    it("reads any status other than ready as pending", () => {
        expect(toUploadView(row("pending")).status).toBe("pending")
        expect(toUploadView(row("")).status).toBe("pending")
    })
})
