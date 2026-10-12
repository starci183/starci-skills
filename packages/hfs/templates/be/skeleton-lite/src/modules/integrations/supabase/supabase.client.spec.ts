import { Secret } from "@modules/platform/config"
import { createSupabaseAdminClient } from "./supabase.client"

describe("createSupabaseAdminClient", () => {
    it("exposes only the Auth administration and Storage surfaces of a session-less service client", () => {
        const client = createSupabaseAdminClient({ url: "http://127.0.0.1:54321", serviceRoleKey: new Secret("service-role") })

        expect(Object.keys(client).sort()).toEqual(["auth", "storage"])
        expect(typeof client.auth.createUser).toBe("function")
        expect(typeof client.storage.from).toBe("function")
    })
})
