import { randomUUID } from "node:crypto"
import { UploadErrorCode } from "@modules/domain/upload"
import { UPLOAD_BY_ID, UPLOAD_COUNT_BY_ID } from "@tests/fixtures/persistence/e2e-verification.sql"
import type { CountRow, UploadRow } from "@tests/fixtures/persistence/e2e-verification.rows"
import type {
    AttachUploadData,
    CreateTaskData,
    CreateUploadIntentData,
    DeleteUploadData,
    RestErrorBody,
    TaskUploadsData,
    UploadView,
} from "@tests/fixtures/views/e2e-views.contracts"
import { useTestWorld } from "@tests/world/use-test-world"
import { AppModule as TodoApp } from "../../../../apps/todo/src/app.module"

/**
 * The upload slice journey over the real api. The control plane is GraphQL (createUploadIntent, attachUpload, taskUploads,
 * deleteUpload); the byte plane is REST (POST /uploads, PUT /uploads/:id/content, GET /uploads/:id/content) over the real
 * local storage in a run-owned directory. Sign in, open a presigned intent for a text file, fulfil it on the api PUT door
 * with the signed token, attach the now-ready upload to a task the caller owns, list it, download the bytes back, then
 * delete row and object together. Negative edges ride along: a mime outside the allowlist is refused before any row exists,
 * a wrong token cannot store, a pending intent cannot attach, a consumed token cannot store twice and another person cannot
 * download. The stored rows are read through the shared entity manager.
 */
describe("upload journey (e2e)", () => {
    const world = useTestWorld({ apps: { todo: { module: TodoApp, listen: true } } })

    it("intent -> presigned PUT -> attach -> list -> download -> delete", async () => {
        const { api } = world.apps.todo
        const owner = await world.signedInPerson("upload")
        const caller = owner.caller

        const created = await caller.graphql<CreateTaskData>("createTask", { input: { title: `e2e upload ${randomUUID()}` } })
        const taskId = created.data?.createTask.taskId ?? ""

        // A mime outside the allowlist is refused before any row or byte exists.
        const refused = await caller.graphql<CreateUploadIntentData>("createUploadIntent", {
            input: { filename: "evil.exe", mime: "application/x-msdownload", sizeBytes: 4 },
        })
        expect(refused.errorCode).toBe(UploadErrorCode.MimeNotAllowed)
        expect(refused.data).toBeNull()

        const content = Buffer.from(`e2e upload payload ${randomUUID()}`, "utf8")
        const opened = await caller.graphql<CreateUploadIntentData>("createUploadIntent", {
            input: { filename: "note.txt", mime: "text/plain", sizeBytes: content.length },
        })
        expect(opened.errorCode).toBeNull()
        const intent = opened.data?.createUploadIntent
        const uploadId = intent?.uploadId ?? ""
        const url = intent?.url ?? ""
        expect(intent?.method).toBe("PUT")
        expect(url).toBe(`/uploads/${uploadId}/content`)
        const tokenHeader = intent?.headers.find((header) => header.name === "x-upload-token")
        expect(tokenHeader?.value).toEqual(expect.any(String))
        const presignedHeaders = Object.fromEntries((intent?.headers ?? []).map((header) => [header.name, header.value]))

        // A pending intent is metadata only: it cannot attach before its bytes land.
        const earlyAttach = await caller.graphql<AttachUploadData>("attachUpload", { input: { uploadId, taskId } })
        expect(earlyAttach.errorCode).toBe(UploadErrorCode.NotReady)

        // The presigned data plane takes no session: the token is the credential; a wrong one is refused before a byte is stored.
        const wrongToken = await api.put<RestErrorBody>(url, content, { headers: { "x-upload-token": "1.bad", "content-type": "text/plain" } })
        expect(wrongToken.status).toBe(403)
        expect(wrongToken.body.code).toBe(UploadErrorCode.TokenInvalid)

        const stored = await api.put<UploadView>(url, content, { headers: { "content-type": "text/plain", ...presignedHeaders } })
        expect(stored.status).toBe(200)
        expect(stored.body.status).toBe("ready")
        expect(stored.body.sizeBytes).toBe(content.length)

        // The consumed token must not store twice.
        const replay = await api.put<RestErrorBody>(url, content, { headers: { "content-type": "text/plain", ...presignedHeaders } })
        expect(replay.status).toBe(403)

        const attached = await caller.graphql<AttachUploadData>("attachUpload", { input: { uploadId, taskId } })
        expect(attached.errorCode).toBeNull()
        expect(attached.data?.attachUpload).toMatchObject({ uploadId, taskId, status: "ready" })

        // The metadata row carries owner, task link, mime, real size and ready.
        const rows: Array<UploadRow> = await world.db.primary.query(UPLOAD_BY_ID, [uploadId])
        expect(rows).toHaveLength(1)
        expect(rows[0]).toMatchObject({
            id: uploadId,
            owner: owner.personId,
            task_id: taskId,
            filename: "note.txt",
            mime: "text/plain",
            size_bytes: content.length,
            status: "ready",
            storage_key: `uploads/${uploadId}`,
        })

        const listed = await caller.graphql<TaskUploadsData>("taskUploads", { input: { taskId } })
        expect(listed.errorCode).toBeNull()
        expect(listed.data?.taskUploads.map((record) => record.uploadId)).toContain(uploadId)

        const download = await caller.get<string>(`/uploads/${uploadId}/content`)
        expect(download.status).toBe(200)
        expect(download.headers["content-type"]).toContain("text/plain")
        expect(Buffer.from(download.body, "utf8").equals(content)).toBe(true)

        // Another person can neither read the bytes nor delete the upload.
        const stranger = await world.signedInPerson("upload-stranger")
        const strangerDownload = await stranger.caller.get<RestErrorBody>(`/uploads/${uploadId}/content`)
        expect(strangerDownload.status).toBe(403)
        expect(strangerDownload.body.code).toBe(UploadErrorCode.Forbidden)
        const strangerDelete = await stranger.caller.graphql<DeleteUploadData>("deleteUpload", { input: { uploadId } })
        expect(strangerDelete.errorCode).toBe(UploadErrorCode.Forbidden)

        // The direct intake answers the same ready record in one step.
        const direct = await caller.post<UploadView>("/uploads", Buffer.from("direct bytes", "utf8"), {
            params: { filename: "direct.txt" },
            headers: { "content-type": "text/plain" },
        })
        expect(direct.status).toBe(201)
        expect(direct.body.status).toBe("ready")
        expect(direct.body.filename).toBe("direct.txt")

        const removed = await caller.graphql<DeleteUploadData>("deleteUpload", { input: { uploadId } })
        expect(removed.errorCode).toBeNull()
        expect(removed.data?.deleteUpload).toEqual({ uploadId, deleted: true })
        const [remaining]: Array<CountRow> = await world.db.primary.query(UPLOAD_COUNT_BY_ID, [uploadId])
        expect(remaining?.count).toBe(0)
        const goneRead = await caller.get<RestErrorBody>(`/uploads/${uploadId}/content`)
        expect(goneRead.status).toBe(404)
        expect(goneRead.body.code).toBe(UploadErrorCode.NotFound)
    })
})
