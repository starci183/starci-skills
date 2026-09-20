import {
    E2EWorld, bootE2EWorld 
} from "@tests/infra/e2e-world"
import {
    E2E_BOOT_TIMEOUT_MS 
} from "@tests/infra/testing-infra.options"

jest.setTimeout(120_000)

// The run-owned realm seeds this identity (.starcistacks/dev/infra/compose/realm-todo.json).
const DEMO = {
    email: "demo@todo.dev", password: "todo-demo-pass" 
}

interface PresignedUpload {
  uploadId: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  expiresAt: string;
}

interface UploadRecord {
  id: string;
  owner: string;
  taskId: string | null;
  filename: string;
  mime: string;
  sizeBytes: number;
  storageKey: string;
  status: string;
}

interface UploadRow {
  id: string;
  owner: string;
  task_id: string | null;
  filename: string;
  mime: string;
  size_bytes: number;
  storage_key: string;
  status: string;
}

interface CountRow {
  count: number;
}

/**
 * The upload slice's journey over the real stack: sign in, open a presigned intent for a text file,
 * fulfil it on the api's own PUT door with the signed token, attach the now-ready upload to a task
 * the caller owns, list it, download the bytes back, then delete row and object together. The
 * Postgres reads are out-of-band verification only - every journey step travels the real HTTP door.
 * Negative edges ride along: a wrong token cannot store, a pending intent cannot attach, and a mime
 * outside the allowlist is refused at the door.
 */
describe("upload journey (e2e)",
    () => {
        let world: E2EWorld

        beforeAll(async () => {
            world = await bootE2EWorld()
            expect((await world.http.anonymous().get<{ status: string }>("/health")).data.status).toBe("ok")
        },
        E2E_BOOT_TIMEOUT_MS)

        afterAll(async () => {
            await world.moduleRef.close()
        })

        it("intent → presigned PUT → attach → list → download → delete",
            async () => {
                const {
                    http, auth, dataSource 
                } = world
                const session = await auth.signIn(DEMO.email,
                    DEMO.password)
                const token = session.token
                const personId = session.personId
                const api = http.forUser(token)

                const created = await http.graphql<{ createTask: { taskId: string } }>("createTask",
                    {
                        variables: {
                            input: {
                                title: `e2e upload ${Date.now()}` 
                            } 
                        }, token 
                    })
                expect(created.errors).toBeNull()
                const taskId = created.data!.createTask.taskId

                // A mime outside the allowlist is refused before any row or byte exists.
                const refused = await api.post<{ code?: string }>("/uploads/intents",
                    {
                        filename: "evil.exe", mime: "application/x-msdownload", sizeBytes: 4 
                    })
                expect(refused.status).toBe(415)
                expect(refused.body.code).toBe("UPLOAD_MIME_NOT_ALLOWED")

                const content = Buffer.from(`e2e upload payload ${Date.now()}`,
                    "utf8")
                const intent = await api.post<PresignedUpload>("/uploads/intents",
                    {
                        filename: "note.txt",
                        mime: "text/plain",
                        sizeBytes: content.length,
                    })
                expect(intent.status).toBe(201)
                expect(intent.body.method).toBe("PUT")
                expect(intent.body.url).toBe(`/uploads/${intent.body.uploadId}/content`)
                expect(intent.body.headers["x-upload-token"]).toEqual(expect.any(String))

                // The presigned data plane takes no session - the token is the credential; a wrong
                // one is refused before a byte is stored.
                const wrongToken = await http.anonymous().put(intent.body.url,
                    content,
                    {
                        headers: {
                            "x-upload-token": "1.bad", "content-type": "text/plain" 
                        } 
                    })
                expect(wrongToken.status).toBe(403)
                expect((wrongToken.body as { code?: string }).code).toBe("UPLOAD_TOKEN_INVALID")

                // A pending intent is metadata only - it cannot attach before its bytes land.
                const earlyAttach = await api.post<{ code?: string }>(`/uploads/${intent.body.uploadId}/attach`,
                    {
                        taskId 
                    })
                expect(earlyAttach.status).toBe(409)
                expect(earlyAttach.body.code).toBe("UPLOAD_NOT_READY")

                const stored = await http.anonymous().put<UploadRecord>(intent.body.url,
                    content,
                    {
                        headers: {
                            ...intent.body.headers 
                        } 
                    })
                expect(stored.status).toBe(200)
                expect(stored.body.status).toBe("ready")
                expect(stored.body.sizeBytes).toBe(content.length)

                // The consumed token must not store twice.
                const replay = await http.anonymous().put(intent.body.url,
                    content,
                    {
                        headers: {
                            ...intent.body.headers 
                        } 
                    })
                expect(replay.status).toBe(403)

                const attached = await api.post<UploadRecord>(`/uploads/${intent.body.uploadId}/attach`,
                    {
                        taskId 
                    })
                expect(attached.status).toBe(201)
                expect(attached.body.taskId).toBe(taskId)

                // Out-of-band: the metadata row carries owner, task link, mime, real size and ready.
                const rows = await dataSource.query<Array<UploadRow>>(
                    "SELECT id, owner, task_id, filename, mime, size_bytes, storage_key, status FROM uploads WHERE id = $1",
                    [intent.body.uploadId],
                )
                expect(rows).toHaveLength(1)
                expect(rows[0]).toMatchObject({
                    id: intent.body.uploadId,
                    owner: personId,
                    task_id: taskId,
                    filename: "note.txt",
                    mime: "text/plain",
                    size_bytes: content.length,
                    status: "ready",
                })
                expect(rows[0].storage_key).toBe(`uploads/${intent.body.uploadId}`)

                const listed = await api.get<Array<UploadRecord>>("/uploads",
                    {
                        params: {
                            taskId 
                        } 
                    })
                expect(listed.status).toBe(200)
                expect(listed.body.map(record => record.id)).toContain(intent.body.uploadId)

                const download = await api.get<string>(`/uploads/${intent.body.uploadId}/content`)
                expect(download.status).toBe(200)
                expect(download.headers["content-type"]).toContain("text/plain")
                expect(Buffer.from(download.body as unknown as string,
                    "utf8").equals(content)).toBe(true)

                // The direct intake answers the same ready record in one step.
                const direct = await api.post<UploadRecord>("/uploads",
                    Buffer.from("direct bytes",
                        "utf8"),
                    {
                        params: {
                            filename: "direct.txt" 
                        },
                        headers: {
                            "content-type": "text/plain" 
                        },
                    })
                expect(direct.status).toBe(201)
                expect(direct.body.status).toBe("ready")

                const removed = await api.delete<{ deleted: boolean }>(`/uploads/${intent.body.uploadId}`)
                expect(removed.status).toBe(200)
                expect(removed.body.deleted).toBe(true)

                const gone = await dataSource.query<Array<CountRow>>(
                    "SELECT COUNT(*)::int AS count FROM uploads WHERE id = $1",
                    [intent.body.uploadId],
                )
                expect(gone[0].count).toBe(0)
                const goneRead = await api.get(`/uploads/${intent.body.uploadId}/content`)
                expect(goneRead.status).toBe(404)
            })
    })
