import type { Principal } from "@modules/platform/cqrs"

/** Identity and the socket transport share the cryptographic Supabase verifier port. */
export type VerifySupabaseAccessToken = (token: string) => Promise<
    { readonly kind: "ok"; readonly value: Principal } | { readonly kind: "refused"; readonly code: string }
>
