"use client"

import type { ReactNode } from "react"
import { Provider } from "react-redux"
import { store } from "./store"

/** What the store provider wraps: the routed tree. */
type ReduxProviderProps = { readonly children: ReactNode }

/** Mounts the app's one store above every route (components/providers/AppProviders). */
export const ReduxProvider = (props: ReduxProviderProps) => <Provider store={store}>{props.children}</Provider>
