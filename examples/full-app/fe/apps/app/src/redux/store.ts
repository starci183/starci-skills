import { configureStore } from "@reduxjs/toolkit"
import { sessionReducer } from "./slices/session"

/** The one store of the app: app-wide shared state only (feature-local state lives in hooks/zustand). */
export const store = configureStore({
    reducer: {
        session: sessionReducer,
    },
})

/** The state of the store, for useAppSelector. */
export type RootState = ReturnType<typeof store.getState>
/** The dispatch of the store, for useAppDispatch. */
export type AppDispatch = typeof store.dispatch
