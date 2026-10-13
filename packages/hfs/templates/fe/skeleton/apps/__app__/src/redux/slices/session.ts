import { createSlice } from "@reduxjs/toolkit"
import type { PayloadAction } from "@reduxjs/toolkit"
import type { AuthSession } from "@/modules/auth"

/** The reader's session as the app shares it: unknown until modules/auth answers, then signed in or signed out. */
export interface SessionState {
    readonly status: "unknown" | "signed-in" | "signed-out"
    readonly session?: AuthSession
}

const initialState: SessionState = { status: "unknown" }

/** The session slice: written only by the auth session effect (hooks/effects), read by any component through useAppSelector. */
export const sessionSlice = createSlice({
    name: "session",
    initialState,
    reducers: {
        sessionChanged: (_state, action: PayloadAction<AuthSession | undefined>): SessionState =>
            action.payload === undefined ? { status: "signed-out" } : { status: "signed-in", session: action.payload },
    },
})

/** The one action of the session slice: modules/auth reported a session (or none). */
export const { sessionChanged } = sessionSlice.actions
/** The reducer the store mounts under `session`. */
export const sessionReducer = sessionSlice.reducer
