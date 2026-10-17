import { getDataSourceToken } from "@nestjs/typeorm"
import { Secret } from "@modules/platform/config"

/** Compiles the real CLI root with public options and a database infrastructure double. */
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
    overrides: [{ token: getDataSourceToken("primary"), value: { manager: {} } }],
})
