import { builder } from "@starci/jest-preset"
import type { FindSessionParams, PurgeSessionsParams, SignInParams, SignOutParams } from "@modules/domain/identity"

/** The columns of a stored row, declared here so a spec never reaches into the persistence of the owner. */
export interface SessionRow {
    token: string
    personId: string
    issuedAt: Date
    expiresAt: Date
}

/** The instant the identity specs treat as now. */
export const IDENTITY_NOW = "2026-09-30T10:00:00.000Z"

/** A stored session of person p1 that is still live at `IDENTITY_NOW`: issued a day before, lapsing a day after. */
export const sessionRow = builder<SessionRow>({
    token: "t1",
    personId: "p1",
    issuedAt: new Date("2026-09-29T10:00:00.000Z"),
    expiresAt: new Date("2026-10-01T10:00:00.000Z"),
})

/** A stored session that lapses exactly at `IDENTITY_NOW`, which counts as lapsed. */
export const lapsedSessionRow = builder<SessionRow>({
    token: "t1",
    personId: "p1",
    issuedAt: new Date("2026-09-29T10:00:00.000Z"),
    expiresAt: new Date(IDENTITY_NOW),
})

/** A valid credential pair. */
export const signInInput = builder<SignInParams>({ email: "a@b.co", password: "pw" })

/** The token of the stored session. */
export const signOutInput = builder<SignOutParams>({ sessionToken: "t1" })

/** Looking up the stored session at `IDENTITY_NOW`. */
export const findSessionInput = builder<FindSessionParams>({ token: "t1", at: new Date(IDENTITY_NOW) })

/** Purging at `IDENTITY_NOW`. */
export const purgeSessionsInput = builder<PurgeSessionsParams>({ at: new Date(IDENTITY_NOW) })
