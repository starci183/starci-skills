"use client"

import type { ReactNode } from "react"
import { moveFocusBetweenPeers } from "../../navigationKeys.js"
import { navigationClassName } from "../../navigationClassNames.js"

export type StepperStepState = "complete" | "current" | "upcoming" | "error"

export type StepperStep = {
    readonly id: string
    readonly label: string
    readonly description?: ReactNode
    /** Overrides the position-derived state, e.g. `error` for a step that failed validation. */
    readonly state?: StepperStepState
    readonly isDisabled?: boolean
}

export type StepperProps = {
    /** Names the progress landmark, e.g. "Checkout progress". */
    readonly label: string
    readonly steps: ReadonlyArray<StepperStep>
    readonly currentStepId: string
    readonly orientation?: "horizontal" | "vertical"
    /** Present only when the reader may jump between steps; each step then becomes a button. */
    readonly onStepSelect?: (id: string) => void
    /** App-owned assistive text per state, e.g. "completed". Omitted states are announced by position only. */
    readonly stateLabel?: (state: StepperStepState) => string | undefined
    /** App-owned marker; defaults to the 1-based step number. */
    readonly renderMarker?: (step: StepperStep, index: number, state: StepperStepState) => ReactNode
    readonly className?: string
}

/** Position-derived state: before the current step is complete, after it is upcoming. */
export const stepStateFor = (steps: ReadonlyArray<StepperStep>, currentStepId: string, index: number): StepperStepState => {
    const step = steps[index]
    if (step?.state !== undefined) return step.state
    const currentIndex = steps.findIndex((candidate) => candidate.id === currentStepId)
    if (index === currentIndex) return "current"
    return currentIndex >= 0 && index < currentIndex ? "complete" : "upcoming"
}

/**
 * A multi-step flow's progress. The current step carries `aria-current="step"`; each step exposes
 * `data-grammar-step-state`. With `onStepSelect` the steps are buttons and the arrow keys move
 * between them. Below 30rem a horizontal stepper keeps only the current step's label in the paint.
 */
export const Stepper = ({
    label,
    steps,
    currentStepId,
    orientation = "horizontal",
    onStepSelect,
    stateLabel,
    renderMarker,
    className,
}: StepperProps) => (
    <nav
        aria-label={label}
        className={navigationClassName("starci-core-stepper", className)}
        data-component="Stepper"
        data-tier="composite"
        data-grammar-stepper-orientation={orientation}
        data-grammar-stepper-interactive={onStepSelect === undefined ? "false" : "true"}
    >
        <ol
            className="starci-core-stepper-list"
            onKeyDown={onStepSelect === undefined ? undefined : (event) => { moveFocusBetweenPeers(event, "[data-grammar-step-control]", orientation === "vertical" ? "vertical" : "horizontal") }}
        >
            {steps.map((step, index) => {
                const state = stepStateFor(steps, currentStepId, index)
                const announcement = stateLabel?.(state)
                const content = <>
                    <span aria-hidden="true" className="starci-core-step-marker" data-grammar-step-marker="true">
                        {renderMarker === undefined ? index + 1 : renderMarker(step, index, state)}
                    </span>
                    <span className="starci-core-step-copy">
                        <span className="starci-core-step-label" data-grammar-step-label="true">{step.label}</span>
                        {announcement === undefined ? null : <span className="starci-core-nav-visually-hidden">{`, ${announcement}`}</span>}
                        {step.description === undefined ? null : <span className="starci-core-step-description" data-grammar-step-description="true">{step.description}</span>}
                    </span>
                </>
                return (
                    <li
                        key={step.id}
                        aria-current={state === "current" ? "step" : undefined}
                        className="starci-core-step"
                        data-grammar-step-state={state}
                        data-grammar-current={state === "current" ? "true" : "false"}
                    >
                        {onStepSelect === undefined ? (
                            <span className="starci-core-step-body">{content}</span>
                        ) : (
                            <button
                                className="starci-core-step-body starci-core-step-control"
                                data-grammar-step-control="true"
                                disabled={step.isDisabled === true}
                                onClick={() => onStepSelect(step.id)}
                                type="button"
                            >
                                {content}
                            </button>
                        )}
                    </li>
                )
            })}
        </ol>
    </nav>
)
