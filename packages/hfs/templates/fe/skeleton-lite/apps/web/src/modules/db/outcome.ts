/** Failure kinds exposed by the database boundary. */
export type DbFailureKind = "refused" | "not-found" | "invalid" | "unavailable"

/** A successful database or Auth operation. */
export interface DbOk<T> {
    readonly kind: "ok"
    readonly value: T
}

/** An expected database or Auth failure. */
export interface DbFailure {
    readonly kind: DbFailureKind
    readonly code: string
}

/** The app's one result vocabulary, owned by the lite database transport. */
export type DbOutcome<T> = DbOk<T> | DbFailure

/** The structural part of a Supabase error this boundary interprets. */
interface SupabaseFailure {
    readonly code?: string
    readonly status?: number
    readonly message: string
}

/** The common structural pair returned by Supabase data and Auth calls. */
export interface SupabaseResult {
    readonly data: unknown
    readonly error: SupabaseFailure | null
}

/** The non-null data carried by one concrete SDK result. */
export type SupabaseData<T extends SupabaseResult> = NonNullable<T["data"]>

/** Wraps a value as a successful outcome. */
export const dbOk = <T>(value: T): DbOk<T> => ({ kind: "ok", value })
/** Builds a refusal without throwing across a Server Action boundary. */
export const dbFailure = (kind: DbFailureKind, code: string): DbFailure => ({ kind, code })

const hasSignal = (error: SupabaseFailure, signals: ReadonlyArray<string>): boolean => {
    const values = [error.code, error.status === undefined ? undefined : String(error.status)]
    return values.some((value) => value !== undefined && signals.includes(value))
}

const hasData = <T>(value: T): value is NonNullable<T> => value !== null && value !== undefined

/** Maps Supabase's data/error pair into the app's closed outcome vocabulary. */
export const toOutcome = <T extends SupabaseResult>(result: T): DbOutcome<SupabaseData<T>> => {
    if (result.error === null) {
        return hasData(result.data) ? dbOk(result.data) : dbFailure("not-found", "empty")
    }
    const code = result.error.code ?? String(result.error.status ?? "transport")
    if (hasSignal(result.error, ["42501", "PGRST301", "401", "403", "invalid_credentials"])) {
        return dbFailure("refused", code)
    }
    if (hasSignal(result.error, ["PGRST116"])) return dbFailure("not-found", code)
    if (result.error.code?.startsWith("23") === true) return dbFailure("invalid", code)
    return dbFailure("unavailable", code)
}
