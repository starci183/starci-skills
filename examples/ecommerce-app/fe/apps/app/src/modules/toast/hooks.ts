"use client"

import { useTranslations } from "next-intl"
import { useCallback, useMemo } from "react"
import type { GraphQLResponse } from "@ecommerce/api"
import { runGraphQLWithToast } from "./api"
import type { RunWithToastOptions, ToastMessages } from "./api"

/** The toast labels of the reader's locale (catalog namespace `shop.toast`). */
const useToastMessages = (): ToastMessages => {
    const t = useTranslations("shop.toast")
    return useMemo(
        () => ({
            successTitle: t("successTitle"),
            errorTitle: t("errorTitle"),
            unauthorizedTitle: t("unauthorizedTitle"),
            unauthorizedDescription: t("unauthorizedDescription"),
            defaultSuccess: t("defaultSuccess"),
            defaultError: t("defaultError"),
        }),
        [t],
    )
}

/** A localized runGraphQLWithToast: every GraphQL write reports its outcome through it. */
export const useGraphQLWithToast = () => {
    const messages = useToastMessages()
    return useCallback(
        <T>(action: () => Promise<GraphQLResponse<T>>, options?: RunWithToastOptions) =>
            runGraphQLWithToast(action, messages, options),
        [messages],
    )
}
