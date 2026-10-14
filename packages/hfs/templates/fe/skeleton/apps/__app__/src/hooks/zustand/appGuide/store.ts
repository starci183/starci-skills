"use client"

import { create } from "zustand"

/** The home guide's local UI state; it carries no session or server data. */
type AppGuideState = {
    readonly isOpen: boolean
    readonly setOpen: (isOpen: boolean) => void
}

/** One feature-local store, shared by the guide trigger and its controlled dialog. */
export const useAppGuideStore = create<AppGuideState>()((set) => ({
    isOpen: false,
    setOpen: (isOpen) => set({ isOpen }),
}))
