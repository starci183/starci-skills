import { Secret } from "@modules/platform/config"
import { PRIMARY_DATA_SOURCE } from "@modules/platform/database"

/** Public fixture options and the database double for compiling the real CLI AppModule without network access. */
export const buildWiringProof = () => ({
    options: {
        connections: [
            {
                name: "primary",
                provider: "supabase",
                url: new Secret("postgresql://app_be@127.0.0.1:5432/postgres"),
                schema: "public",
            },
        ],
    },
    overrides: [{ token: PRIMARY_DATA_SOURCE, value: { manager: {} } }],
})
