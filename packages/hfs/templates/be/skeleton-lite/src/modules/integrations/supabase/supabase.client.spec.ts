import { Test } from "@nestjs/testing"
import { Secret } from "@modules/platform/config"
import { createSupabaseAdminClient } from "./supabase.client"
import type { SupabaseAdminClient } from "./supabase.client"
import { SUPABASE_ADMIN_CLIENT } from "./supabase.decorators"

describe("createSupabaseAdminClient", () => {
    it("exposes only the Auth administration and Storage surfaces of a session-less service client", async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [
                {
                    provide: SUPABASE_ADMIN_CLIENT,
                    useFactory: () =>
                        createSupabaseAdminClient({
                            url: "http://127.0.0.1:54321",
                            serviceRoleKey: new Secret("service-role"),
                        }),
                },
            ],
        }).compile()
        const client = moduleRef.get<SupabaseAdminClient>(SUPABASE_ADMIN_CLIENT)

        expect(Object.keys(client).sort()).toEqual(["auth", "storage"])
        expect(typeof client.auth.createUser).toBe("function")
        expect(typeof client.storage.from).toBe("function")
    })
})
