import fsPromises from "node:fs/promises"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "./primary.decorators"
import { SeedRunnerService } from "./seed-runner.service"

const SEED = "INSERT INTO public.calendars (id, owner_id) VALUES ('calendar-1', 'person-1');\n"

const build = async (entityManager: MockEntityManager, seed: string) => {
    const readFile = jest.spyOn(fsPromises, "readFile").mockResolvedValue(seed)
    const moduleRef = await Test.createTestingModule({
        providers: [SeedRunnerService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return { runner: moduleRef.get(SeedRunnerService), readFile }
}

describe("SeedRunnerService", () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    it("executes the tracked seed file verbatim through the primary EntityManager", async () => {
        const em = mockEntityManager({ query: [SEED, []] })
        const { runner, readFile } = await build(em, SEED)

        await runner.run()

        expect(readFile).toHaveBeenCalledWith("supabase/seed.sql", "utf8")
        expect(em.query).toHaveBeenCalledWith(SEED)
    })

    it.each(["", "  \n\t"])("executes nothing when the seed file holds no statement (%p)", async (seed) => {
        const em = mockEntityManager()
        const { runner } = await build(em, seed)

        await runner.run()

        expect(em.query).not.toHaveBeenCalled()
    })

    it("fails when the seed file cannot be read", async () => {
        const em = mockEntityManager()
        const { runner, readFile } = await build(em, SEED)
        const failure = new Error("ENOENT: no such file or directory")
        readFile.mockRejectedValue(failure)

        await expect(runner.run()).rejects.toBe(failure)
        expect(em.query).not.toHaveBeenCalled()
    })
})
