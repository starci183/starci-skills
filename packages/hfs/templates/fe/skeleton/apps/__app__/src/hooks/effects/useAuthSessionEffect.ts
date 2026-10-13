"use client"

import { useEffect } from "react"
import { authClient } from "@/modules/auth"
import { sessionChanged, useAppDispatch } from "@/redux"

/** Keeps the redux session slice equal to modules/auth: the session it has now, then every change it reports. */
export const useAuthSessionEffect = (): void => {
    const dispatch = useAppDispatch()
    useEffect(() => {
        let active = true
        void authClient.session().then((session) => {
            if (active) dispatch(sessionChanged(session))
        })
        const unsubscribe = authClient.onChange((session) => dispatch(sessionChanged(session)))
        return () => {
            active = false
            unsubscribe()
        }
    }, [dispatch])
}
