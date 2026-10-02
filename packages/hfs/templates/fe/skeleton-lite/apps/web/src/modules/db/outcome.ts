/** Failure vocabulary shared by every Supabase reader and writer. */
export type DbFailureKind = "refused" | "not-found" | "invalid" | "unavailable"

/** A successful database or Auth operation. */
export interface DbOutcomeOk<T> {
    readonly kind: "ok"
    readonly value: T
}

/** An expected refusal with a stable kind and provider code. */
export interface DbOutcomeFailure {
    readonly kind: DbFailureKind
    readonly code: string
}

/** The result of a Supabase operation. */
export type DbOutcome<T> = DbOutcomeOk<T> | DbOutcomeFailure

/** The structural part of a Supabase error this boundary interprets. */
interface SupabaseFailure {
    readonly code?: string
    readonly status?: number
    readonly message: string
}

/** A Supabase result with both halves present. */
export interface SupabaseResult<T> {
    readonly data: T
    readonly error: SupabaseFailure | null
}

/** Wraps a value as a successful outcome. */
export const dbOk = <T>(value: T): DbOutcomeOk<T> => ({ kind: "ok", value })
/** Builds a refusal without throwing across a Server Action boundary. */
export const dbFailure = (kind: DbFailureKind, code: string): DbOutcomeFailure => ({ kind, code })

const hasSignal = (error: SupabaseFailure, signals: ReadonlyArray<string>): boolean => {
    const values = [error.code, error.status === undefined ? undefined : String(error.status)]
    return values.some((value) => value !== undefined && signals.includes(value))
}

/** Maps Supabase's data/error pair into the app's closed outcome vocabulary. */
export const toOutcome = <T>(result: SupabaseResult<T>): DbOutcome<T> => {
    if (result.error === null) return dbOk(result.data)
    const code = result.error.code ?? String(result.error.status ?? "transport")
    if (hasSignal(result.error, ["42501", "PGRST301", "401", "403", "invalid_credentials"])) {
        return dbFailure("refused", code)
    }
    if (hasSignal(result.error, ["PGRST116"])) return dbFailure("not-found", code)
    if (result.error.code?.startsWith("23") === true) return dbFailure("invalid", code)
    return dbFailure("unavailable", code)
}
