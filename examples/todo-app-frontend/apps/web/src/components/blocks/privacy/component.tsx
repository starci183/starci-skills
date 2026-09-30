import { Button, GrammarRoot, Heading, SurfaceCard, Text, TextAction } from "@starci/grammar/common"
import { AccountShell, type AccountShellCopy } from "@/components/composites/AccountShell"
import { ROUTES } from "@/modules/routes"
import {
    PRIVACY_ACTION_ROW_CLASS_NAME,
    CONFIRM_ROW_CLASS_NAME,
    FACE_CLASS_NAME,
    PRIVACY_RULE_CLASS_NAME,
} from "./classNames"

/**
 * The pure render of ui.audit.privacy; every one of its six states is decided by the caller's
 * `state` prop and stamped on the root as `data-state`. No hooks, no transport, no world state.
 */

export const PRIVACY_STATES = [
    "idle",
    "exporting",
    "requesting-erasure",
    "erasure-pending",
    "erasure-complete",
    "erasure-refused",
] as const

/** The closed ui.audit.privacy state vocabulary; the owner picks exactly one per render. */
export type PrivacyState = (typeof PRIVACY_STATES)[number]

/** Every word the pure privacy screen renders, resolved by the connected half. */
export type PrivacyViewCopy = AccountShellCopy & {
    readonly backToTasks: string
    readonly heading: string
    readonly tagline: string
    /** The joined card's accessible name; the two sections inside name themselves. */
    readonly cardLabel: string
    readonly exportHeading: string
    readonly exportTagline: string
    readonly exportAction: string
    readonly exporting: string
    readonly erasureHeading: string
    readonly erasureTagline: string
    readonly erasureAction: string
    readonly erasureConfirm: string
    readonly erasureCancel: string
    readonly erasurePending: string
    readonly erasureComplete: string
}

/** The view's complete contract: one state, the refusal sentences, every word to draw, and the six
 * user intents. */
export interface PrivacyViewProps {
    readonly state: PrivacyState
    /** The refusal sentence the owner derived from the real failure; rendered only in erasure-refused. */
    readonly refusal: string | null
    /** A failed export's own sentence; the export section reports it without leaving the idle state. */
    readonly exportRefusal: string | null
    readonly copy: PrivacyViewCopy
    readonly onExport: () => void
    readonly onRequestErasure: () => void
    readonly onConfirmErasure: () => void
    readonly onCancelErasure: () => void
    readonly onSignOut: () => void
}

/** Pure view for the privacy screen: renders the workspace shell and every mapped privacy state. */
export const PrivacyView = (props: PrivacyViewProps) => {
    const copy = props.copy
    const { state, refusal, exportRefusal } = props
    const erasureBusy = state === "erasure-pending"
    const complete = state === "erasure-complete"

    return (
        <GrammarRoot data-state={state}>
            <AccountShell copy={copy} currentHref={ROUTES.privacy} onSignOut={props.onSignOut}>
                <div>
                    <Heading level={1} scale="display">
                        {copy.heading}
                    </Heading>
                    <Text tone="muted">{copy.tagline}</Text>
                </div>
                <SurfaceCard ariaLabel={copy.cardLabel} composition="joined" frame="frameless">
                    <div role="region" aria-label={copy.exportHeading} className={FACE_CLASS_NAME}>
                        <Heading level={2}>{copy.exportHeading}</Heading>
                        <Text tone="muted">{copy.exportTagline}</Text>
                        {complete ? null : (
                            <div className={PRIVACY_ACTION_ROW_CLASS_NAME}>
                                <Button
                                    isDisabled={erasureBusy}
                                    isPending={state === "exporting"}
                                    onPress={props.onExport}
                                    variant="secondary"
                                >
                                    {state === "exporting" ? copy.exporting : copy.exportAction}
                                </Button>
                            </div>
                        )}
                        {exportRefusal === null ? null : <Text live="assertive">{exportRefusal}</Text>}
                    </div>
                    <div aria-hidden="true" className={PRIVACY_RULE_CLASS_NAME} />
                    <div role="region" aria-label={copy.erasureHeading} className={FACE_CLASS_NAME}>
                        <Heading level={2}>{copy.erasureHeading}</Heading>
                        <Text tone="muted">{copy.erasureTagline}</Text>
                        {state === "erasure-refused" && refusal !== null ? (
                            <Text live="assertive">{refusal}</Text>
                        ) : null}
                        {complete ? (
                            <Text live="polite">{copy.erasureComplete}</Text>
                        ) : state === "requesting-erasure" ? (
                            <div className={CONFIRM_ROW_CLASS_NAME}>
                                <Button onPress={props.onConfirmErasure} variant="outline">
                                    {copy.erasureConfirm}
                                </Button>
                                <Button onPress={props.onCancelErasure} variant="ghost">
                                    {copy.erasureCancel}
                                </Button>
                            </div>
                        ) : (
                            <>
                                {erasureBusy ? (
                                    <Text live="polite" tone="muted">
                                        {copy.erasurePending}
                                    </Text>
                                ) : null}
                                <div className={PRIVACY_ACTION_ROW_CLASS_NAME}>
                                    <Button isDisabled={erasureBusy} onPress={props.onRequestErasure} variant="outline">
                                        {copy.erasureAction}
                                    </Button>
                                    <TextAction appearance="inline" href={ROUTES.tasks}>
                                        {copy.backToTasks}
                                    </TextAction>
                                </div>
                            </>
                        )}
                    </div>
                </SurfaceCard>
                <div aria-hidden="true" className={PRIVACY_RULE_CLASS_NAME} />
            </AccountShell>
        </GrammarRoot>
    )
}
