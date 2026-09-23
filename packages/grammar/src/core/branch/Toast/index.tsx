import { Spinner as HeroSpinner } from "@heroui/react"
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react"
import type { PresentationState } from "../../../common/state.js"
import { Button } from "../../primitive/Button/index.js"
import { CloseButton } from "../../primitive/CloseButton/index.js"

export type ToastAction = {
    readonly label: string
    readonly onAction: () => void
}

export type ToastOptions = {
    readonly title: string
    readonly description?: string
    /** Render-neutral meaning. `negative` is announced assertively; everything else politely. */
    readonly tone?: PresentationState
    readonly action?: ToastAction
    /**
     * Milliseconds before auto-dismiss; `0` keeps the toast until dismissed. Default: 6000, except
     * toasts that carry an action or are `negative`/`pending`, which persist so nobody is timed out of
     * a decision (WCAG 2.2.1). Timers pause while the toaster is hovered or holds focus.
     */
    readonly timeout?: number
}

export type ToastRecord = ToastOptions & {
    readonly id: string
    /** Bumped on every update so timers restart and the announcement repeats. */
    readonly version: number
}

export type ToastQueue = {
    readonly add: (options: ToastOptions) => string
    readonly update: (id: string, options: Partial<ToastOptions>) => void
    readonly dismiss: (id: string) => void
    readonly clear: () => void
    readonly subscribe: (listener: () => void) => () => void
    readonly getSnapshot: () => readonly ToastRecord[]
}

export const DEFAULT_TOAST_TIMEOUT = 6000

/** Resolve the effective auto-dismiss delay; `0` means the toast persists. */
export const toastTimeoutFor = (toast: ToastOptions): number => {
    if (toast.timeout !== undefined) return Math.max(0, toast.timeout)
    if (toast.action !== undefined || toast.tone === "negative" || toast.tone === "pending") return 0
    return DEFAULT_TOAST_TIMEOUT
}

/** Create an isolated toast queue (one per app shell, or per test). */
export const createToastQueue = (): ToastQueue => {
    let toasts: readonly ToastRecord[] = []
    let sequence = 0
    const listeners = new Set<() => void>()
    const emit = () => { for (const listener of listeners) listener() }

    return {
        add: (options) => {
            sequence += 1
            const id = `grammar-toast-${sequence}`
            toasts = [{ ...options, id, version: 0 }, ...toasts]
            emit()
            return id
        },
        update: (id, options) => {
            toasts = toasts.map((toast) => toast.id === id ? { ...toast, ...options, id, version: toast.version + 1 } : toast)
            emit()
        },
        dismiss: (id) => {
            const next = toasts.filter((toast) => toast.id !== id)
            if (next.length === toasts.length) return
            toasts = next
            emit()
        },
        clear: () => {
            if (toasts.length === 0) return
            toasts = []
            emit()
        },
        subscribe: (listener) => {
            listeners.add(listener)
            return () => { listeners.delete(listener) }
        },
        getSnapshot: () => toasts,
    }
}

/** The shared app-wide queue a `Toaster` reads when no `queue` prop is given. */
export const toastQueue: ToastQueue = createToastQueue()

export type ToastProps = {
    readonly toast: ToastRecord
    readonly dismissLabel: string
    readonly onDismiss: () => void
    /** Timers stop while paused (the toaster is hovered or focused, or the page is hidden). */
    readonly isPaused?: boolean
}

/**
 * BRANCH - `Toast`: one transient notification, rendered by `Toaster`.
 *
 * Escape dismisses a focused toast. The timer counts only while not paused, and restarts when the
 * toast is updated. Tone is echoed on `data-grammar-tone`.
 * Contract: A11Y-4 (decisions never time out) FOCUS-5 (Escape = close button) CORE-BOUNDARY-4 MOTION-2.
 */
export const Toast = ({ toast, dismissLabel, onDismiss, isPaused = false }: ToastProps) => {
    const tone = toast.tone ?? "neutral"
    const timeout = toastTimeoutFor(toast)
    const remaining = useRef(timeout)
    const seenVersion = useRef(toast.version)
    const dismissRef = useRef(onDismiss)
    dismissRef.current = onDismiss

    useEffect(() => {
        if (seenVersion.current !== toast.version) {
            seenVersion.current = toast.version
            remaining.current = timeout
        }
        if (isPaused || timeout <= 0) return
        const startedAt = Date.now()
        const handle = setTimeout(() => dismissRef.current(), Math.max(0, remaining.current))
        return () => {
            clearTimeout(handle)
            remaining.current -= Date.now() - startedAt
        }
    }, [isPaused, timeout, toast.version])

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== "Escape") return
        event.stopPropagation()
        onDismiss()
    }

    return (
        <div
            data-tier="branch"
            data-component="Toast"
            data-grammar-tone={tone}
            data-grammar-overlay-surface="toast"
            data-persistent={timeout <= 0 ? "true" : "false"}
            data-contract="A11Y-4 FOCUS-5 CORE-BOUNDARY-4 MOTION-2"
            className="starci-core-toast"
            onKeyDown={onKeyDown}
        >
            {tone === "pending" ? (
                <span className="starci-core-toast-indicator" aria-hidden="true" data-contract="ICON-6">
                    <HeroSpinner role="presentation" aria-hidden="true" size="sm" color="current" />
                </span>
            ) : <span className="starci-core-toast-indicator" data-grammar-toast-indicator={tone} aria-hidden="true" data-contract="ICON-6" />}
            <div className="starci-core-toast-copy">
                <p className="starci-core-toast-title">{toast.title}</p>
                {toast.description === undefined ? null : <p className="starci-core-toast-description">{toast.description}</p>}
            </div>
            {toast.action === undefined ? null : (
                <span className="starci-core-toast-action" data-grammar-toast-action="true">
                    <Button
                        size="sm"
                        variant="secondary"
                        onPress={() => {
                            toast.action?.onAction()
                            onDismiss()
                        }}
                    >
                        {toast.action.label}
                    </Button>
                </span>
            )}
            <CloseButton label={dismissLabel} size="sm" onPress={onDismiss} />
        </div>
    )
}

export type ToasterPlacement = "top-start" | "top" | "top-end" | "bottom-start" | "bottom" | "bottom-end"

export type ToasterProps = {
    /** Landmark name for the notification region (the app resolves the words). */
    readonly label: string
    /** Name for every toast's dismiss button. */
    readonly dismissLabel: string
    readonly queue?: ToastQueue
    readonly placement?: ToasterPlacement
    /** How many toasts are drawn at once; older ones wait in the queue. Default 3. */
    readonly maxVisible?: number
}

const announcementFor = (toast: ToastRecord) => (
    toast.description === undefined ? toast.title : `${toast.title}. ${toast.description}`
)

const usePageHidden = () => {
    const [hidden, setHidden] = useState(false)
    useEffect(() => {
        const update = () => setHidden(document.visibilityState === "hidden")
        update()
        document.addEventListener("visibilitychange", update)
        return () => document.removeEventListener("visibilitychange", update)
    }, [])
    return hidden
}

/**
 * BRANCH - `Toaster`: the fixed notification region that renders a toast queue.
 *
 * Mount it ONCE inside the app's `GrammarRoot`: it is rendered in place (no portal), so it is always
 * inside the family scope that mounted it. Announcements go through two persistent, visually hidden
 * live regions (polite `role="status"`, assertive `role="alert"`) that exist before any toast
 * arrives; the visible toasts are a labelled region of ordinary, keyboard-reachable content.
 * Contract: region LAYOUT-4 (fixed); each live region FEEDBACK-3 (one announcement owner per urgency).
 */
export const Toaster = ({ label, dismissLabel, queue = toastQueue, placement = "bottom-end", maxVisible = 3 }: ToasterProps) => {
    const toasts = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot)
    const [isHovered, setIsHovered] = useState(false)
    const [hasFocus, setHasFocus] = useState(false)
    const pageHidden = usePageHidden()
    const [polite, setPolite] = useState("")
    const [assertive, setAssertive] = useState("")
    const announced = useRef(new Map<string, number>())
    const visible = toasts.slice(0, Math.max(1, maxVisible))
    const isPaused = isHovered || hasFocus || pageHidden

    useEffect(() => {
        const seen = announced.current
        for (const toast of [...visible].reverse()) {
            if (seen.get(toast.id) === toast.version) continue
            seen.set(toast.id, toast.version)
            if (toast.tone === "negative") setAssertive(announcementFor(toast))
            else setPolite(announcementFor(toast))
        }
        for (const id of seen.keys()) if (!toasts.some((toast) => toast.id === id)) seen.delete(id)
    })

    return (
        <section
            data-tier="branch"
            data-component="Toaster"
            data-placement={placement}
            data-paused={isPaused ? "true" : "false"}
            data-contract="LAYOUT-4"
            aria-label={label}
            className="starci-core-toaster"
            onPointerEnter={() => setIsHovered(true)}
            onPointerLeave={() => setIsHovered(false)}
            onFocus={() => setHasFocus(true)}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHasFocus(false)
            }}
        >
            <span role="status" aria-live="polite" aria-atomic="true" className="starci-core-visually-hidden" data-grammar-toaster-live="polite" data-contract="FEEDBACK-3">{polite}</span>
            <span role="alert" aria-live="assertive" aria-atomic="true" className="starci-core-visually-hidden" data-grammar-toaster-live="assertive" data-contract="FEEDBACK-3">{assertive}</span>
            <ol className="starci-core-toaster-list">
                {visible.map((toast) => (
                    <li key={toast.id} className="starci-core-toaster-item">
                        <Toast toast={toast} dismissLabel={dismissLabel} isPaused={isPaused} onDismiss={() => queue.dismiss(toast.id)} />
                    </li>
                ))}
            </ol>
        </section>
    )
}
