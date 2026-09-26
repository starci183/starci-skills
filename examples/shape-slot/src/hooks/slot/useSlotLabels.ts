"use client"

import { useTranslations } from "next-intl"
import type { SlotLabels } from "@/modules/slot"

/** Resolves the shared data-status copy once, adding the slot's own empty sentence. */
export const useSlotLabels = () => {
    const t = useTranslations("slot")
    return (empty: string): SlotLabels => ({
        empty,
        forbidden: t("forbidden"),
        error: t("error"),
        retry: t("retry"),
    })
}
