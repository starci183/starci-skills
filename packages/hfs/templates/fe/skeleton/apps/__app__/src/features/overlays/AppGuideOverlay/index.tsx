"use client"

import { useTranslations } from "next-intl"
import { useAppGuideStore } from "@/hooks/zustand/appGuide"
import { AppGuideOverlayBase } from "./component"

/** The home guide connects localized copy to its feature-local zustand store. */
export const AppGuideOverlay = () => {
    const t = useTranslations("app.guide")
    const isOpen = useAppGuideStore((state) => state.isOpen)
    const setOpen = useAppGuideStore((state) => state.setOpen)
    return (
        <AppGuideOverlayBase
            props={{
                isOpen,
                triggerLabel: t("open"),
                title: t("title"),
                description: t("description"),
                closeLabel: t("close"),
            }}
            on={{ openChange: setOpen }}
        />
    )
}
