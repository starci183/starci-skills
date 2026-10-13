"use client"

import { useAppSelector } from "@/redux"

/** The reader's session as the app shares it (redux, kept by the auth session effect): unknown, signed in or signed out. */
export const useSession = () => useAppSelector((state) => state.session)
