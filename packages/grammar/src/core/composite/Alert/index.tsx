import { Alert as HeroAlert, Spinner as HeroSpinner } from "@heroui/react"
import { useState, type ReactNode } from "react"
import type { PresentationState } from "../../../common/state.js"
import { vendorStatusFor } from "../../overlayScope.js"
import { Button } from "../../primitive/Button/index.js"
import { CloseButton } from "../../primitive/CloseButton/index.js"

export type AlertUrgency = "polite" | "assertive"

export type AlertAction = {
    readonly label: string
    readonly onAction: () => void
}

type AlertBase = {
    readonly title: string
    readonly description?: ReactNode
    /** Render-neutral meaning of the banner. Default `informative`. */
    readonly tone?: PresentationState
    readonly action?: AlertAction
    /**
     * How the banner is announced when it appears. Default: `assertive` (`role="alert"`) for a
     * `negative` tone, `polite` (`role="status"`) for everything else.
     */
    readonly urgency?: AlertUrgency
}

/** A dismissible banner must name its close action; a permanent one has neither prop. */
type Dismissible = {
    readonly dismissLabel: string
    readonly onDismiss?: () => void
}

type Permanent = {
    readonly dismissLabel?: never
    readonly onDismiss?: never
}

export type AlertProps = AlertBase & (Dismissible | Permanent)

/**
 * COMPOSITE - `Alert`: an inline, in-flow banner about the region it sits in.
 *
 * It is not an overlay: it takes layout space and stays until resolved or dismissed. Dismissal is
 * uncontrolled (the banner removes itself) and `onDismiss` reports it. Tone is echoed on
 * `data-grammar-tone`; the vendor status supplies the default glyph, `pending` swaps it for a spinner.
 * Contract: root FEEDBACK-3 (status/alert urgency on the owner); actions FEEDBACK-2 (recovery in place).
 */
export const Alert = (props: AlertProps) => {
    const { title, description, tone = "informative", action, urgency } = props
    const [isDismissed, setIsDismissed] = useState(false)
    if (isDismissed) return null

    const resolvedUrgency = urgency ?? (tone === "negative" ? "assertive" : "polite")
    const dismiss = () => {
        setIsDismissed(true)
        props.onDismiss?.()
    }

    return (
        <HeroAlert
            data-tier="composite"
            data-component="Alert"
            data-grammar-tone={tone}
            data-urgency={resolvedUrgency}
            data-contract="FEEDBACK-3"
            role={resolvedUrgency === "assertive" ? "alert" : "status"}
            status={vendorStatusFor(tone)}
            className="starci-core-alert"
        >
            <HeroAlert.Indicator className="starci-core-alert-indicator">
                {tone === "pending" ? <HeroSpinner aria-hidden="true" role="presentation" size="sm" color="current" /> : undefined}
            </HeroAlert.Indicator>
            <HeroAlert.Content className="starci-core-alert-content">
                <HeroAlert.Title className="starci-core-alert-title">{title}</HeroAlert.Title>
                {description === undefined ? null : (
                    <HeroAlert.Description className="starci-core-alert-description">{description}</HeroAlert.Description>
                )}
            </HeroAlert.Content>
            {action === undefined && props.dismissLabel === undefined ? null : (
                <span className="starci-core-alert-actions" data-grammar-alert-actions="true" data-contract="FEEDBACK-2">
                    {action === undefined ? null : (
                        <Button size="sm" variant="secondary" onPress={action.onAction}>{action.label}</Button>
                    )}
                    {props.dismissLabel === undefined ? null : (
                        <CloseButton label={props.dismissLabel} size="sm" onPress={dismiss} />
                    )}
                </span>
            )}
        </HeroAlert>
    )
}
