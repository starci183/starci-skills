"use client"

import { Fieldset as HeroFieldset } from "@heroui/react"
import { useId, type ReactNode } from "react"
import { fieldStateAttributes } from "../../primitive/Field/index.js"

export type FieldsetProps = {
    /** The group's name, announced before every control inside it. */
    readonly legend: ReactNode
    readonly isLegendHidden?: boolean
    readonly description?: ReactNode
    /** A cross-field problem (e.g. two values that disagree), not a single control's error. */
    readonly errorMessage?: ReactNode
    readonly children: ReactNode
    /** Buttons that act on this group, laid out after the fields. */
    readonly actions?: ReactNode
    /** Disables every control inside, including the ones rendered as `div` by the vendor. */
    readonly isDisabled?: boolean
}

/** A named group of related fields: a native `fieldset` + `legend` with the field rhythm. */
export const Fieldset = ({ legend, isLegendHidden = false, description, errorMessage, children, actions, isDisabled = false }: FieldsetProps) => {
    const id = useId().replace(/:/g, "")
    const descriptionId = description == null ? undefined : `fieldset${id}-description`
    const errorId = errorMessage == null ? undefined : `fieldset${id}-error`
    const describedBy = [descriptionId, errorId].filter((part) => part !== undefined).join(" ")

    return (
        <HeroFieldset
            data-tier="composite"
            data-component="Fieldset"
            className="starci-core-fieldset"
            disabled={isDisabled}
            {...(describedBy === "" ? {} : { "aria-describedby": describedBy })}
            {...fieldStateAttributes({ isInvalid: errorMessage != null, isDisabled })}
        >
            <HeroFieldset.Legend
                className={isLegendHidden ? "starci-core-fieldset-legend starci-core-form-label--screen-reader" : "starci-core-fieldset-legend"}
                data-grammar-fieldset-legend="true"
            >
                {legend}
            </HeroFieldset.Legend>
            {descriptionId === undefined ? null : (
                <p id={descriptionId} className="starci-core-field-description" data-grammar-field-description="true">{description}</p>
            )}
            <HeroFieldset.Group className="starci-core-fieldset-fields" data-grammar-fieldset-fields="true">{children}</HeroFieldset.Group>
            {errorId === undefined ? null : (
                <p id={errorId} className="starci-core-field-error" data-grammar-field-error="true">{errorMessage}</p>
            )}
            {actions == null ? null : (
                <HeroFieldset.Actions className="starci-core-fieldset-actions" data-grammar-fieldset-actions="true">{actions}</HeroFieldset.Actions>
            )}
        </HeroFieldset>
    )
}
