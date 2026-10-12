import { Secret } from "@modules/platform/config"
import { createSupabaseAdminClient } from "./supabase.client"
import type { SupabaseOptions } from "./supabase.options"

const options: SupabaseOptions = {
    url: "https://project.supabase.test",
    serviceRoleKey: new Secret("service-role-key"),
}

describe("createSupabaseAdminClient", () => {
    it("exposes Auth administration and Storage, and nothing else", () => {
        const client = createSupabaseAdminClient(options)

        expect(Object.keys(client).sort()).toEqual(["auth", "storage"])
        expect(typeof client.auth.createUser).toBe("function")
        expect(typeof client.auth.deleteUser).toBe("function")
        expect(typeof client.storage.from).toBe("function")
    })

    it("builds a separate client for every call", () => {
        const first = createSupabaseAdminClient(options)
        const second = createSupabaseAdminClient(options)

        expect(first.auth).not.toBe(second.auth)
        expect(first.storage).not.toBe(second.storage)
    })
})
