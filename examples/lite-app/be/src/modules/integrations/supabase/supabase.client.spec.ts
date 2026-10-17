import { Test } from "@nestjs/testing"
import { SUPABASE_ADMIN_CLIENT } from "./supabase.decorators"
import type { SupabaseAdminClient } from "./supabase.client"
import { Secret } from "@modules/platform/config"
import { createSupabaseAdminClient } from "./supabase.client"
import type { SupabaseOptions } from "./supabase.options"

const options: SupabaseOptions = {
    url: "https://project.supabase.test",
    serviceRoleKey: new Secret("service-role-key"),
}

const build = async (): Promise<SupabaseAdminClient> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUPABASE_ADMIN_CLIENT, useFactory: () => createSupabaseAdminClient(options) }],
    }).compile()
    return moduleRef.get<SupabaseAdminClient>(SUPABASE_ADMIN_CLIENT)
}

describe("createSupabaseAdminClient", () => {
    it("exposes Auth administration and Storage, and nothing else", async () => {
        const client = await build()

        expect(Object.keys(client).sort()).toEqual(["auth", "storage"])
        expect(typeof client.auth.createUser).toBe("function")
        expect(typeof client.auth.deleteUser).toBe("function")
        expect(typeof client.storage.from).toBe("function")
    })

    it("builds a separate client for every call", async () => {
        const first = await build()
        const second = await build()

        expect(first.auth).not.toBe(second.auth)
        expect(first.storage).not.toBe(second.storage)
    })
})
