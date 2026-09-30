import { randomUUID } from "node:crypto"
import { bootE2eWorld } from "../setup/e2e-world"
import type { E2EWorld } from "../setup/e2e-world"
import { present } from "../setup/e2e.error"
import type {
    AttachUploadData,
    CreateTaskData,
    CreateUploadIntentData,
    DeleteUploadData,
    RestErrorBody,
    TaskUploadsData,
    UploadView,
} from "../setup/e2e-views.contracts"

/**
 * The upload slice journey over the real stack. The control plane is GraphQL (createUploadIntent, attachUpload, taskUploads,
 * deleteUpload); the byte plane is REST (POST /uploads, PUT /uploads/:id/content, GET /uploads/:id/content). Sign in, open a
 * presigned intent for a text file, fulfil it on the api PUT door with the signed token, attach the now-ready upload to a task
 * the caller owns, list it, download the bytes back, then delete row and object together. The Postgres reads are out-of-band
 * verification only: every journey step travels a real door. Negative edges ride along: a mime outside the allowlist is
 * refused before any row exists, a wrong token cannot store, a pending intent cannot attach, a consumed token cannot store
 * twice and another person cannot download.
 */
describe("upload journey (e2e)", () => {
    let world: E2EWorld

    beforeAll(async () => {
        world = await bootE2eWorld("upload/upload-journey")
        expect((await world.http().get<{ status: string }>("/health")).body.status).toBe("ok")
    }, 600_000)

    afterAll(async () => {
        await world.close()
        expect(world.stack.cleanupReport?.clean).toBe(true)
    })

    it("intent -> presigned PUT -> attach -> list -> download -> delete", async () => {
        const { graphql, auth, database } = world
        const session = await auth.persona("owner")
        const caller = graphql.client(session.sessionToken)
        const rest = world.http(session.sessionToken)
        const anonymousRest = world.http()

        const created = await caller.mutate<CreateTaskData>("createTask", { variables: { input: { title: `e2e upload ${randomUUID()}` } } })
        const taskId = present(created.data, "createTask data").createTask.taskId

        // A mime outside the allowlist is refused before any row or byte exists.
        const refused = await caller.mutate<CreateUploadIntentData>("createUploadIntent", {
            variables: { input: { filename: "evil.exe", mime: "application/x-msdownload", sizeBytes: 4 } },
        })
        expect(refused.errorCode).toBe("UPLOAD_MIME_NOT_ALLOWED")
        expect(refused.data).toBeNull()

        const content = Buffer.from(`e2e upload payload ${randomUUID()}`, "utf8")
        const opened = await caller.mutate<CreateUploadIntentData>("createUploadIntent", {
            variables: { input: { filename: "note.txt", mime: "text/plain", sizeBytes: content.length } },
        })
        expect(opened.errorCode).toBeNull()
        const intent = present(opened.data, "createUploadIntent data").createUploadIntent
        expect(intent.method).toBe("PUT")
        expect(intent.url).toBe(`/uploads/${intent.uploadId}/content`)
        const tokenHeader = present(
            intent.headers.find((header) => header.name === "x-upload-token"),
            "the upload token header of the intent",
        )
        expect(tokenHeader.value).toEqual(expect.any(String))
        const presignedHeaders = Object.fromEntries(intent.headers.map((header) => [header.name, header.value]))

        // A pending intent is metadata only: it cannot attach before its bytes land.
        const earlyAttach = await caller.mutate<AttachUploadData>("attachUpload", { variables: { input: { uploadId: intent.uploadId, taskId } } })
        expect(earlyAttach.errorCode).toBe("UPLOAD_NOT_READY")

        // The presigned data plane takes no session: the token is the credential; a wrong one is refused before a byte is stored.
        const wrongToken = await anonymousRest.put<RestErrorBody>(intent.url, content, {
            headers: { "x-upload-token": "1.bad", "content-type": "text/plain" },
        })
        expect(wrongToken.status).toBe(403)
        expect(wrongToken.body.code).toBe("UPLOAD_TOKEN_INVALID")

        const stored = await anonymousRest.put<UploadView>(intent.url, content, { headers: { "content-type": "text/plain", ...presignedHeaders } })
        expect(stored.status).toBe(200)
        expect(stored.body.status).toBe("ready")
        expect(stored.body.sizeBytes).toBe(content.length)

        // The consumed token must not store twice.
        const replay = await anonymousRest.put<RestErrorBody>(intent.url, content, { headers: { "content-type": "text/plain", ...presignedHeaders } })
        expect(replay.status).toBe(403)

        const attached = await caller.mutate<AttachUploadData>("attachUpload", { variables: { input: { uploadId: intent.uploadId, taskId } } })
        expect(attached.errorCode).toBeNull()
        expect(attached.data?.attachUpload).toMatchObject({ uploadId: intent.uploadId, taskId, status: "ready" })

        // Out-of-band: the metadata row carries owner, task link, mime, real size and ready.
        const rows = await database.uploadById(intent.uploadId)
        expect(rows).toHaveLength(1)
        expect(rows[0]).toMatchObject({
            id: intent.uploadId,
            owner: session.personId,
            task_id: taskId,
            filename: "note.txt",
            mime: "text/plain",
            size_bytes: content.length,
            status: "ready",
            storage_key: `uploads/${intent.uploadId}`,
        })

        const listed = await caller.read<TaskUploadsData>("taskUploads", { variables: { input: { taskId } } })
        expect(listed.errorCode).toBeNull()
        expect(listed.data?.taskUploads.map((record) => record.uploadId)).toContain(intent.uploadId)

        const download = await rest.get<string>(`/uploads/${intent.uploadId}/content`)
        expect(download.status).toBe(200)
        expect(download.headers["content-type"]).toContain("text/plain")
        expect(Buffer.from(download.body, "utf8").equals(content)).toBe(true)

        // Another person can neither read the bytes nor delete the upload.
        const stranger = await auth.persona("other")
        const strangerDownload = await world.http(stranger.sessionToken).get<RestErrorBody>(`/uploads/${intent.uploadId}/content`)
        expect(strangerDownload.status).toBe(403)
        expect(strangerDownload.body.code).toBe("UPLOAD_FORBIDDEN")
        const strangerDelete = await graphql.client(stranger.sessionToken).mutate<DeleteUploadData>("deleteUpload", {
            variables: { input: { uploadId: intent.uploadId } },
        })
        expect(strangerDelete.errorCode).toBe("UPLOAD_FORBIDDEN")

        // The direct intake answers the same ready record in one step.
        const direct = await rest.post<UploadView>("/uploads", Buffer.from("direct bytes", "utf8"), {
            params: { filename: "direct.txt" },
            headers: { "content-type": "text/plain" },
        })
        expect(direct.status).toBe(201)
        expect(direct.body.status).toBe("ready")
        expect(direct.body.filename).toBe("direct.txt")

        const removed = await caller.mutate<DeleteUploadData>("deleteUpload", { variables: { input: { uploadId: intent.uploadId } } })
        expect(removed.errorCode).toBeNull()
        expect(removed.data?.deleteUpload).toEqual({ uploadId: intent.uploadId, deleted: true })
        expect(await database.uploadCountById(intent.uploadId)).toBe(0)
        const goneRead = await rest.get<RestErrorBody>(`/uploads/${intent.uploadId}/content`)
        expect(goneRead.status).toBe(404)
        expect(goneRead.body.code).toBe("UPLOAD_NOT_FOUND")
    })
})
