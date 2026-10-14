"use client"

import { useEffect } from "react"
import { authClient } from "@/modules/auth"
import { sessionChanged, useAppDispatch } from "@/redux"

/**
 * Keeps the redux session slice equal to modules/auth by subscribing to its session events: the subscription reports the
 * session the reader has now, then every change. It starts no load of its own; the unsubscribe ends it.
 */
export const useAuthSessionEffect = (): void => {
    const dispatch = useAppDispatch()
    useEffect(() => authClient.onChange((session) => dispatch(sessionChanged(session))), [dispatch])
}
