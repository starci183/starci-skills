import { Button, GrammarRoot, Heading, SurfaceCard, Text, TextAction } from "@starci/grammar/common"
import { AccountShell, type AccountShellCopy } from "@/components/composites/AccountShell"
import { ROUTES } from "@/modules/routes"
import {
    NOTIFY_ACTION_ROW_CLASS_NAME,
    HEADING_GROUP_CLASS_NAME,
    NOTIFY_RULE_CLASS_NAME,
    TOGGLE_ROW_CLASS_NAME,
    UNSUBSCRIBE_GROUP_CLASS_NAME,
} from "./classNames"

/** The closed ui.notify.preferences state vocabulary; the owner picks exactly one per render. */
export const NOTIFY_PREFERENCES_STATES = ["loading", "subscribed", "unsubscribed", "saving", "refused"] as const

/** One member of the ui.notify.preferences state vocabulary. */
export type NotifyPreferencesState = (typeof NOTIFY_PREFERENCES_STATES)[number]

/** Every word the pure preferences screen renders, resolved by the connected half. */
export type NotifyPreferencesViewCopy = AccountShellCopy & {
    readonly backToTasks: string
    /** The screen title, which is also the digest card's accessible name. */
    readonly heading: string
    readonly tagline: string
    readonly digestHeading: string
    readonly digestTagline: string
    readonly on: string
    readonly off: string
    readonly turnOn: string
    readonly turnOff: string
    readonly unsubscribedNote: string
    readonly save: string
    readonly saving: string
    readonly unsubscribe: string
    readonly unsubscribeHint: string
}

/** The view's complete contract: the resolved state, the displayed preference, the refusal
 * sentence when one applies, which write is pending, every word to draw, and the four user intents
 * plus sign out. */
export interface NotifyPreferencesViewProps {
    readonly state: NotifyPreferencesState
    /** The preference the toggle currently shows - the saved value, or the unsaved draft once the
     * owner flips it. `null` means the value has not loaded yet, so the control rests as a skeleton. */
    readonly subscribed: boolean | null
    /** The refusal sentence the owner settled on; rendered only while `state` is `refused`. */
    readonly refusal: string | null
    /** Which write is in flight. `save` drives the save Button's busy label and pending; `unsubscribe`
     * marks the unsubscribe text action pending. Either one disables every write control. */
    readonly pending: "save" | "unsubscribe" | null
    readonly copy: NotifyPreferencesViewCopy
    readonly onToggle: () => void
    readonly onSave: () => void
    readonly onUnsubscribe: () => void
    readonly onSignOut: () => void
}

/** The pure render of ui.notify.preferences; every one of its five states is decided by the
 * caller's `state` prop and stamped on the root as `data-state`. No hooks, no transport, no world
 * state. */
export const NotifyPreferencesView = (props: NotifyPreferencesViewProps) => {
    const copy = props.copy
    const { state, subscribed, refusal, pending } = props
    const busy = pending !== null

    return (
        <GrammarRoot data-state={state}>
            <AccountShell copy={copy} currentHref={ROUTES.notifyPreferences} onSignOut={props.onSignOut}>
                <div className={HEADING_GROUP_CLASS_NAME}>
                    <Heading level={1}>{copy.heading}</Heading>
                    <Text tone="muted">{copy.tagline}</Text>
                </div>
                <SurfaceCard ariaLabel={copy.heading}>
                    <Heading level={2}>{copy.digestHeading}</Heading>
                    <Text tone="muted">{copy.digestTagline}</Text>
                    {state === "refused" && refusal !== null ? <Text live="assertive">{refusal}</Text> : null}
                    <div className={TOGGLE_ROW_CLASS_NAME}>
                        <Text weight="medium" isSkeleton={subscribed === null}>
                            {subscribed === false ? copy.off : copy.on}
                        </Text>
                        <Button
                            variant={subscribed === false ? "secondary" : "primary"}
                            isDisabled={subscribed === null || busy}
                            isSkeleton={subscribed === null}
                            onPress={props.onToggle}
                        >
                            {subscribed === false ? copy.turnOn : copy.turnOff}
                        </Button>
                    </div>
                    {state === "unsubscribed" ? <Text live="polite">{copy.unsubscribedNote}</Text> : null}
                </SurfaceCard>
                <div className={NOTIFY_ACTION_ROW_CLASS_NAME}>
                    <Button
                        variant="primary"
                        isDisabled={subscribed === null || busy}
                        isPending={pending === "save"}
                        onPress={props.onSave}
                    >
                        {pending === "save" ? copy.saving : copy.save}
                    </Button>
                    <TextAction appearance="inline" href={ROUTES.tasks}>
                        {copy.backToTasks}
                    </TextAction>
                </div>
                <div aria-hidden="true" className={NOTIFY_RULE_CLASS_NAME} />
                <div className={UNSUBSCRIBE_GROUP_CLASS_NAME}>
                    <TextAction
                        appearance="inline"
                        isDisabled={busy}
                        isPending={pending === "unsubscribe"}
                        onPress={props.onUnsubscribe}
                    >
                        {copy.unsubscribe}
                    </TextAction>
                    <Text size="sm" tone="muted">
                        {copy.unsubscribeHint}
                    </Text>
                </div>
            </AccountShell>
        </GrammarRoot>
    )
}
