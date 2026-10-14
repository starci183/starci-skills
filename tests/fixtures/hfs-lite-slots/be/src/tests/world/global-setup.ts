import type { EntityManager } from "typeorm"
import { PRIMARY_ENTITY_MANAGER, sql } from "@modules/platform/database"
import { createTestDatabaseContext } from "./test-world.config"

/** Checks the local Supabase CLI stack; starci supabase start applies its migrations before this run. */
export default async function globalSetup(): Promise<void> {
    const context = await createTestDatabaseContext({ modules: [] })
    try {
        await context.init()
        const manager = context.get<EntityManager>(PRIMARY_ENTITY_MANAGER)
        await manager.query(sql`select 1`)
    } finally {
        await context.close()
    }
}
