import {
    getEntityManagerToken 
} from "@nestjs/typeorm"
import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    AppConfigService 
} from "@modules/platform/config/app-config.service"
import {
    POSTGRESQL_PRIMARY 
} from "@modules/platform/databases/postgresql/primary/constants/connection"
import {
    TaskEntity 
} from "@modules/platform/databases/postgresql/primary/entities/task.entity"
import {
    UploadEntity 
} from "@modules/platform/databases/postgresql/primary/entities/upload.entity"
import {
    createFakeEntityManager 
} from "@modules/platform/databases/postgresql/primary/testing/fake-entity-manager"
import {
    TaskForbiddenException 
} from "@modules/shared/exceptions/errors/task/task-forbidden"
import {
    TaskNotFoundException 
} from "@modules/shared/exceptions/errors/task/task-not-found"
import {
    UploadForbiddenException 
} from "@modules/shared/exceptions/errors/upload/upload-forbidden"
import {
    UploadMimeNotAllowedException 
} from "@modules/shared/exceptions/errors/upload/upload-mime-not-allowed"
import {
    UploadNotReadyException 
} from "@modules/shared/exceptions/errors/upload/upload-not-ready"
import {
    UploadScanRejectedException 
} from "@modules/shared/exceptions/errors/upload/upload-scan-rejected"
import {
    UploadTokenInvalidException 
} from "@modules/shared/exceptions/errors/upload/upload-token-invalid"
import {
    UploadTooLargeException 
} from "@modules/shared/exceptions/errors/upload/upload-too-large"
import {
    UploadStoragePort, VirusScanPort 
} from "./upload.contracts"
import {
    UploadService 
} from "./upload.service"
import {
    UPLOAD_TOKEN_HEADER 
} from "./upload-token"

const MAX_BYTES = 16
const MIMES = ["text/plain"]

/**
 * Two entity tables behind one fake manager, dispatched on the target the service passes - the same
 * createFakeEntityManager the other capability specs use, once per entity, so findOneBy/save on
 * UploadEntity and TaskEntity both behave like the real EntityManager calls. Rebuilt per test so no
 * row leaks between cases.
 */
const makeFakeEntityManager = () => {
    const uploadsStore = createFakeEntityManager<UploadEntity>("id")
    const tasksStore = createFakeEntityManager<TaskEntity>("id")
    return {
        tasksStore,
        manager: {
            findOneBy: (target: unknown, where: object) =>
                (target === UploadEntity ? uploadsStore : tasksStore).findOneBy(target,
                    where as never),
            findBy: (target: unknown, where: object) =>
                (target === UploadEntity ? uploadsStore : tasksStore).findBy(target,
                    where as never),
            save: (target: unknown, entity: object) =>
                (target === UploadEntity ? uploadsStore : tasksStore).save(target,
                    entity as never),
            delete: (target: unknown, criteria: unknown) =>
                (target === UploadEntity ? uploadsStore : tasksStore).delete(target,
                    criteria),
        },
    }
}

/** An in-memory UploadStoragePort: the same contract the real adapter satisfies, without a disk. */
const makeFakeStorage = () => {
    const objects = new Map<string, Buffer>()
    return {
        objects,
        put: jest.fn(async (key: string, content: Buffer) => {
            objects.set(key,
                content)
        }),
        get: jest.fn(async (key: string) => objects.get(key) ?? null),
        delete: jest.fn(async (key: string) => {
            objects.delete(key)
        }),
    }
}

const makeConfig = () => ({
    getUploadMaxBytes: () => MAX_BYTES,
    getUploadAllowedMimes: () => MIMES,
    getUploadSigningSecret: () => "spec-secret",
    getUploadPresignTtlMs: () => 60_000,
})

/**
 * The upload capability's service contract: intake validation on both doors, the presigned token
 * lifecycle (verify -> pending -> ready -> replay refused), scan rejection deleting stored bytes, and
 * the owner/ready rules on attach, read and delete.
 */
describe("upload service",
    () => {
        let moduleRef: TestingModule
        let service: UploadService
        let storage: ReturnType<typeof makeFakeStorage>
        let scanner: { scan: jest.Mock }
        let fake: ReturnType<typeof makeFakeEntityManager>

        const seedTask = async (id: string, owner: string) => {
            await fake.tasksStore.save(TaskEntity,
                {
                    id, owner, title: "t", complete: false, completedAt: null 
                })
        }

        beforeEach(async () => {
            fake = makeFakeEntityManager()
            storage = makeFakeStorage()
            scanner = {
                scan: jest.fn(async () => undefined) 
            }
            moduleRef = await Test.createTestingModule({
                providers: [UploadService,
                    {
                        provide: getEntityManagerToken(POSTGRESQL_PRIMARY), useValue: fake.manager 
                    },
                    {
                        provide: UploadStoragePort, useValue: storage 
                    },
                    {
                        provide: VirusScanPort, useValue: scanner 
                    },
                    {
                        provide: AppConfigService, useValue: makeConfig() 
                    }],
            }).compile()
            service = moduleRef.get(UploadService)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("createIntent refuses a mime outside the allowlist and a size over the cap before writing anything",
            async () => {
                await expect(service.createIntent("p-1",
                    "a.txt",
                    "application/x-msdownload",
                    4)).rejects.toBeInstanceOf(UploadMimeNotAllowedException)
                await expect(service.createIntent("p-1",
                    "a.txt",
                    "text/plain",
                    MAX_BYTES + 1)).rejects.toBeInstanceOf(UploadTooLargeException)
                expect(storage.put).not.toHaveBeenCalled()
            })

        it("fulfils the whole presigned flow: intent -> token PUT -> ready row with real size",
            async () => {
                const intent = await service.createIntent("p-1",
                    "note.txt",
                    "text/plain",
                    3)
                expect(intent.method).toBe("PUT")
                expect(intent.url).toBe(`/uploads/${intent.uploadId}/content`)
                const token = intent.headers[UPLOAD_TOKEN_HEADER]
                expect(token).toEqual(expect.any(String))

                const record = await service.acceptContent(intent.uploadId,
                    token,
                    Buffer.from("abc"))
                expect(record.status).toBe("ready")
                expect(record.sizeBytes).toBe(3)
                expect(storage.objects.get(`uploads/${intent.uploadId}`)?.toString("utf8")).toBe("abc")
                expect(scanner.scan).toHaveBeenCalledWith(`uploads/${intent.uploadId}`,
                    Buffer.from("abc"))
            })

        it("refuses a wrong/absent token and refuses replaying a consumed intent",
            async () => {
                const intent = await service.createIntent("p-1",
                    "note.txt",
                    "text/plain",
                    3)
                await expect(service.acceptContent(intent.uploadId,
                    undefined,
                    Buffer.from("abc"))).rejects.toBeInstanceOf(UploadTokenInvalidException)
                await expect(service.acceptContent(intent.uploadId,
                    "1.bad",
                    Buffer.from("abc"))).rejects.toBeInstanceOf(UploadTokenInvalidException)
                expect(storage.put).not.toHaveBeenCalled()

                await service.acceptContent(intent.uploadId,
                    intent.headers[UPLOAD_TOKEN_HEADER],
                    Buffer.from("abc"))
                // The same token cannot store twice - the row is already ready.
                await expect(service.acceptContent(intent.uploadId,
                    intent.headers[UPLOAD_TOKEN_HEADER],
                    Buffer.from("xyz"))).rejects.toBeInstanceOf(UploadTokenInvalidException)
                expect(storage.objects.get(`uploads/${intent.uploadId}`)?.toString("utf8")).toBe("abc")
            })

        it("refuses received bytes over the cap even when the intent declared a small size",
            async () => {
                const intent = await service.createIntent("p-1",
                    "note.txt",
                    "text/plain",
                    3)
                await expect(service.acceptContent(intent.uploadId,
                    intent.headers[UPLOAD_TOKEN_HEADER],
                    Buffer.alloc(MAX_BYTES + 1))).rejects.toBeInstanceOf(UploadTooLargeException)
            })

        it("deletes stored bytes and keeps the row pending when the scan rejects the object",
            async () => {
                scanner.scan.mockRejectedValue(new UploadScanRejectedException({
                    reason: "signature-match" 
                }))
                const intent = await service.createIntent("p-1",
                    "note.txt",
                    "text/plain",
                    3)
                await expect(service.acceptContent(intent.uploadId,
                    intent.headers[UPLOAD_TOKEN_HEADER],
                    Buffer.from("abc"))).rejects.toBeInstanceOf(UploadScanRejectedException)
                expect(storage.objects.has(`uploads/${intent.uploadId}`)).toBe(false)
            })

        it("attach refuses a pending upload, a stranger's task and a stranger's upload",
            async () => {
                await seedTask("task-1",
                    "p-1")
                await seedTask("task-2",
                    "p-2")
                const intent = await service.createIntent("p-1",
                    "note.txt",
                    "text/plain",
                    3)

                // Pending content cannot attach.
                await expect(service.attach(intent.uploadId,
                    "task-1",
                    "p-1")).rejects.toBeInstanceOf(UploadNotReadyException)
                // ...and a task that is not there at all is a task refusal, not an upload one.
                await service.acceptContent(intent.uploadId,
                    intent.headers[UPLOAD_TOKEN_HEADER],
                    Buffer.from("abc"))
                await expect(service.attach(intent.uploadId,
                    "task-missing",
                    "p-1")).rejects.toBeInstanceOf(TaskNotFoundException)
                await expect(service.attach(intent.uploadId,
                    "task-2",
                    "p-1")).rejects.toBeInstanceOf(TaskForbiddenException)

                const attached = await service.attach(intent.uploadId,
                    "task-1",
                    "p-1")
                expect(attached.taskId).toBe("task-1")
                // The same upload in a stranger's hands is forbidden on every verb.
                await expect(service.attach(intent.uploadId,
                    "task-1",
                    "p-2")).rejects.toBeInstanceOf(UploadForbiddenException)
                await expect(service.listForTask("task-1",
                    "p-2")).rejects.toBeInstanceOf(TaskForbiddenException)
                expect((await service.listForTask("task-1",
                    "p-1")).map(record => record.id)).toEqual([intent.uploadId])
            })

        it("createDirect stores and scans in one step; readContent returns the bytes to the owner only",
            async () => {
                const record = await service.createDirect("p-1",
                    "note.txt",
                    "text/plain",
                    Buffer.from("hello"))
                expect(record.status).toBe("ready")

                const { content } = await service.readContent(record.id,
                    "p-1")
                expect(content.toString("utf8")).toBe("hello")
                await expect(service.readContent(record.id,
                    "p-2")).rejects.toBeInstanceOf(UploadForbiddenException)
            })

        it("remove deletes the object and the row; a second delete is a not-found",
            async () => {
                const record = await service.createDirect("p-1",
                    "note.txt",
                    "text/plain",
                    Buffer.from("hello"))
                await service.remove(record.id,
                    "p-1")
                expect(storage.objects.has(record.storageKey)).toBe(false)
                await expect(service.readContent(record.id,
                    "p-1")).rejects.toMatchObject({
                    code: "UPLOAD_NOT_FOUND_EXCEPTION" 
                })
                await expect(service.remove(record.id,
                    "p-2")).rejects.toMatchObject({
                    code: "UPLOAD_NOT_FOUND_EXCEPTION" 
                })
            })
    })
