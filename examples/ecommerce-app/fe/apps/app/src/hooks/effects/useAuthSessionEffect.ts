"use client"

import { useEffect } from "react"
import { authClient } from "@/modules/auth"
import { sessionChanged, useAppDispatch } from "@/redux"

/** Keeps the redux session slice equal to modules/auth: the session it holds now, then every change it reports. */
export const useAuthSessionEffect = (): void => {
    const dispatch = useAppDispatch()
    useEffect(() => {
        dispatch(sessionChanged(authClient.session()))
        return authClient.onChange((session) => dispatch(sessionChanged(session)))
    }, [dispatch])
}
