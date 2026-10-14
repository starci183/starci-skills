import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the Supabase integration. */
export enum SupabaseErrorCode {
    /** The access token failed signature or required-claim verification. */
    AccessTokenInvalid = "SUPABASE_ACCESS_TOKEN_INVALID",
}

/** How each Supabase integration code travels. */
export const SUPABASE_ERROR_KINDS: Record<SupabaseErrorCode, ErrorKind> = {
    [SupabaseErrorCode.AccessTokenInvalid]: "unauthenticated",
}

/** The one error class of the Supabase integration. */
export class SupabaseError extends DomainError<SupabaseErrorCode> {}
