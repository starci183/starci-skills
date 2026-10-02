import { outcomeFailure, outcomeOk } from "@/modules/api/outcome"
import type { Outcome, OutcomeFailure, OutcomeFailureKind, OutcomeOk } from "@/modules/api/outcome"

/** Failure kinds exposed by the database boundary. */
export type DbFailureKind = OutcomeFailureKind

/** The app outcome specialized for a database or Auth operation. */
export type DbOutcome<T> = Outcome<T>

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
type SupabaseData<T extends SupabaseResult> = NonNullable<T["data"]>

/** Wraps a value as a successful outcome. */
export const dbOk = <T>(value: T): OutcomeOk<T> => outcomeOk(value)
/** Builds a refusal without throwing across a Server Action boundary. */
export const dbFailure = (kind: DbFailureKind, code: string): OutcomeFailure => outcomeFailure(kind, code)

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
