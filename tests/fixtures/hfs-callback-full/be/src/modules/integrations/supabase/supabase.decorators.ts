import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { SupabaseAdminClient } from "./supabase.client"
import type { VerifySupabaseAccessToken } from "./supabase.options"

/** Token of the integration's Auth and Storage administrator. */
export const SUPABASE_ADMIN_CLIENT: unique symbol = Symbol("integrations.supabase.admin-client")
/** Token of the cryptographic Supabase access-token verifier. */
export const SUPABASE_ACCESS_TOKEN_VERIFIER: unique symbol = Symbol("integrations.supabase.access-token-verifier")

/** Injects the Auth and Storage administrator. Parameter type: SupabaseAdminClient. */
export const InjectSupabaseAdminClient = (): TypedParameterDecorator<SupabaseAdminClient> =>
    injector<SupabaseAdminClient>(SUPABASE_ADMIN_CLIENT)

/** Injects the access-token verifier. Parameter type: VerifySupabaseAccessToken. */
export const InjectSupabaseAccessTokenVerifier = (): TypedParameterDecorator<VerifySupabaseAccessToken> =>
    injector<VerifySupabaseAccessToken>(SUPABASE_ACCESS_TOKEN_VERIFIER)
