import { describe, expect, it } from "@jest/globals"
import { DatabaseModule, sql } from "@modules/platform/database"
import { useTestWorld } from "../../world/use-test-world"

describe("the local Supabase primary connection", () => {
    const world = useTestWorld({ modules: [DatabaseModule] })

    it("runs queries through the shared EntityManager with database constraints enabled", async () => {
        const rows = await world.db.primary.query<Array<{ session_replication_role: string }>>(sql`show session_replication_role`)
        expect(rows).toEqual([{ session_replication_role: "origin" }])
    })
})
