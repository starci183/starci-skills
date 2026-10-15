"use client"

import { useDebugValue } from "react"
import { useAppSelector } from "@/redux"

/** The reader's session as the app shares it (redux, kept by the auth session effect): unknown, signed in or signed out. */
export const useSession = () => {
    const session = useAppSelector((state) => state.session)
    useDebugValue(session.status)
    return session
}
