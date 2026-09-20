import {
    mkdtemp, rm 
} from "node:fs/promises"
import {
    tmpdir 
} from "node:os"
import {
    join 
} from "node:path"
import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    AppConfigService 
} from "@modules/platform/config/app-config.service"
import {
    LocalStorageAdapter 
} from "./local-storage.adapter"

/**
 * The storage-adapter contract, exercised against a real (temp) filesystem: put/get/delete roundtrip
 * under one root, get answering null for a missing key, delete treating a missing key as a no-op, and
 * the containment check refusing any key that would land outside the root. A minio adapter later must
 * satisfy this same shape - this spec is the contract it signs up to.
 */
describe("local storage adapter",
    () => {
        let moduleRef: TestingModule
        let adapter: LocalStorageAdapter
        let dir: string

        beforeAll(async () => {
            dir = await mkdtemp(join(tmpdir(),
                "upload-adapter-spec-"))
            moduleRef = await Test.createTestingModule({
                providers: [LocalStorageAdapter,
                    {
                        provide: AppConfigService,
                        useValue: {
                            getUploadStorageDir: () => dir 
                        },
                    }],
            }).compile()
            adapter = moduleRef.get(LocalStorageAdapter)
        })

        afterAll(async () => {
            await moduleRef.close()
            await rm(dir,
                {
                    recursive: true, force: true 
                })
        })

        it("round-trips an object and deletes it; a missing key reads null and deletes quietly",
            async () => {
                const key = "uploads/spec-object"
                expect(await adapter.get(key)).toBeNull()

                const content = Buffer.from("the bytes",
                    "utf8")
                await adapter.put(key,
                    content)
                expect((await adapter.get(key))?.toString("utf8")).toBe("the bytes")

                await adapter.delete(key)
                expect(await adapter.get(key)).toBeNull()
                // Deleting what is already gone is a no-op, not a failure.
                await adapter.delete(key)
            })

        it("refuses a storage key that escapes the configured root with the storage-unavailable code",
            async () => {
                await expect(adapter.put("../escape",
                    Buffer.from("x"))).rejects.toMatchObject({
                    code: "UPLOAD_STORAGE_UNAVAILABLE_EXCEPTION",
                    metadata: {
                        reason: expect.stringContaining("escapes the upload root") 
                    },
                })
            })
    })
