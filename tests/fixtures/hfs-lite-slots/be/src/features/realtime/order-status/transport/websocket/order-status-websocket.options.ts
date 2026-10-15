import type { VerifySupabaseAccessToken } from "@modules/integrations/supabase"

/** The options of the order-status socket transport: the cryptographic verifier that authenticates each connection. */
export interface OrderStatusWebsocketOptions {
    /** Verifies the access token of a handshake with the same verifier identity uses. */
    readonly verifyAccessToken: VerifySupabaseAccessToken
}
