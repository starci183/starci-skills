"use client"

import type { ReactNode } from "react"
import { Provider } from "react-redux"
import { store } from "./store"

/** Mounts the app's one store above every route (components/providers/AppProviders). */
export const ReduxProvider = (props: { readonly children: ReactNode }) => (
    <Provider store={store}>{props.children}</Provider>
)
