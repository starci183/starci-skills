"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useSessionToken } from "@/hooks/auth"
import { clearToken } from "@/modules/session"
import { completeErasure, endSession, exportMyData, requestErasure } from "./api"
import { PrivacyView, type PrivacyState } from "./component"

/** PrivacyBlock takes no external props; the session and every action lifecycle are its own. */
export type PrivacyBlockProps = Record<never, never>


/** An authentication refusal must say so; every other submission failure uses the settled sentence. */
const isAuthRefusal = (error: unknown): boolean => {
    const code = error instanceof Error && error.cause instanceof Error ? error.cause.message : ""
    return code === "UNAUTHENTICATED" || code === "UNAUTHORIZED" || code === "FORBIDDEN"
}

/** Hands the exported lines to the reader as a real file download - the honest client form of
 * fr.audit.export's "Get a copy of your personal activity records." */
const downloadExport = (lines: ReadonlyArray<{ readonly at: string; readonly action: string; readonly target: string }>): void => {
    const blob = new Blob([JSON.stringify(lines, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "todo-app-export.json"
    anchor.click()
    URL.revokeObjectURL(url)
}

/**
 * The connected owner of ui.audit.privacy: it holds the export and erasure lifecycles (world state),
 * resolves the one state PrivacyView renders, and hands every render path to the pure view in
 * ./component.tsx. Export and erasure stay independent; a confirmed erasure runs requestErasure then
 * completeErasure, the two real mutations the backend already serves.
 */
export const PrivacyBlock = (props: PrivacyBlockProps) => {
    void props
    const t = useTranslations("privacy")
    const tShell = useTranslations("shell")
    const token = useSessionToken()
    const router = useRouter()
    const [state, setState] = useState<PrivacyState>("idle")
    const [refusal, setRefusal] = useState<string | null>(null)
    const [exportRefusal, setExportRefusal] = useState<string | null>(null)

    const onExport = async () => {
        if (state === "exporting" || state === "erasure-pending" || state === "erasure-complete") return
        setExportRefusal(null)
        if (!token) {
            setExportRefusal(t("exportSessionEnded"))
            return
        }
        setState("exporting")
        try {
            downloadExport(await exportMyData(token))
            setState("idle")
        } catch {
            setState("idle")
            setExportRefusal(t("exportRefusal"))
        }
    }

    const onRequestErasure = () => {
        if (state !== "idle" && state !== "erasure-refused") return
        setRefusal(null)
        setState("requesting-erasure")
    }

    const onCancelErasure = () => {
        if (state !== "requesting-erasure") return
        setState("idle")
    }

    const onConfirmErasure = async () => {
        if (state !== "requesting-erasure") return
        setState("erasure-pending")
        if (!token) {
            setRefusal(t("erasureSessionEnded"))
            setState("erasure-refused")
            return
        }
        try {
            const request = await requestErasure(token)
            await completeErasure(token, request.requestId)
            setState("erasure-complete")
        } catch (error) {
            setRefusal(isAuthRefusal(error) ? t("erasureSessionEnded") : t("erasureRefusal"))
            setState("erasure-refused")
        }
    }

    const onSignOut = async () => {
        if (token) await endSession(token)
        clearToken()
        router.push("/sign-in")
    }

    return (
        <PrivacyView
            copy={{
                brand: tShell("brand"),
                accountName: tShell("accountName"),
                signOut: tShell("signOut"),
                navLabel: tShell("navPrimary"),
                destinations: {
                    tasks: tShell("destinations.tasks"),
                    notifications: tShell("destinations.notifications"),
                    plan: tShell("destinations.plan"),
                    privacy: tShell("destinations.privacy"),
                },
                legal: {
                    privacyPolicy: tShell("legal.privacyPolicy"),
                    terms: tShell("legal.terms"),
                },
                backToTasks: tShell("backToTasks"),
                breadcrumbLabel: tShell("breadcrumb"),
                mainLabel: t("mainLabel"),
                breadcrumb: t("breadcrumb"),
                heading: t("heading"),
                tagline: t("tagline"),
                cardLabel: t("cardLabel"),
                exportHeading: t("exportHeading"),
                exportTagline: t("exportTagline"),
                exportAction: t("exportAction"),
                exporting: t("exporting"),
                erasureHeading: t("erasureHeading"),
                erasureTagline: t("erasureTagline"),
                erasureAction: t("erasureAction"),
                erasureConfirm: t("erasureConfirm"),
                erasureCancel: t("erasureCancel"),
                erasurePending: t("erasurePending"),
                erasureComplete: t("erasureComplete"),
            }}
            exportRefusal={exportRefusal}
            onCancelErasure={onCancelErasure}
            onConfirmErasure={onConfirmErasure}
            onExport={onExport}
            onRequestErasure={onRequestErasure}
            onSignOut={onSignOut}
            refusal={refusal}
            state={state}
        />
    )
}
