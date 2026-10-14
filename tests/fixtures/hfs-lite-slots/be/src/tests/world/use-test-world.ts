import { afterAll, beforeAll } from "@jest/globals"
import type { TestingModule } from "@nestjs/testing"
import type { EntityManager } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { createTestDatabaseContext } from "./test-world.config"
import type { ModulesWorldOptions } from "./test-world.config"
import { TestWorldError, TestWorldErrorCode } from "./test-world.error"

/** Lite integration tests share the real manager and keep all constraints enabled. */
export interface TestWorld {
    readonly db: { readonly primary: EntityManager }
}

/** Compiles selected capability modules; it opens no app, container or infrastructure stack. */
export const useTestWorld = (options: ModulesWorldOptions): TestWorld => {
    let context: TestingModule | undefined
    beforeAll(async () => {
        context = await createTestDatabaseContext(options)
        await context.init()
    })
    afterAll(async () => {
        await context?.close()
        context = undefined
    })
    return {
        get db() {
            if (context === undefined) throw new TestWorldError({ code: TestWorldErrorCode.NotReady })
            return { primary: context.get<EntityManager>(PRIMARY_ENTITY_MANAGER) }
        },
    }
}
