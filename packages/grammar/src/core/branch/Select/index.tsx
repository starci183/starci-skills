"use client"

import {
    ListBox as HeroListBox,
    Select as HeroSelect,
    Spinner as HeroSpinner,
    type Key,
} from "@heroui/react"
import { useState, type ReactNode } from "react"
import {
    FieldDescription,
    FieldErrorText,
    FieldLabel,
    useGrammarPortal,
    vendorFieldProps,
    type FieldControlProps,
} from "../../primitive/Field/index.js"

/** One choice in a list-backed control. `label` is plain text because it is also the typeahead value. */
export type ListOption = {
    readonly id: string
    readonly label: string
    readonly description?: ReactNode
    readonly isDisabled?: boolean
}

export type SelectProps = FieldControlProps & {
    readonly options: ReadonlyArray<ListOption>
    readonly placeholder?: string
    readonly value?: string | null
    readonly defaultValue?: string | null
    readonly onValueChange?: (value: string | null) => void
    /** Options are still arriving. The trigger stays named and focusable, announces pending, and does not open. */
    readonly isPending?: boolean
}

const toValue = (key: Key | null): string | null => (key === null ? null : String(key))

/** Renders the options as vendor list-box items with the selected-state indicator. */
export const ListOptions = ({ options }: { readonly options: ReadonlyArray<ListOption> }) => (
    <>
        {options.map((option) => (
            <HeroListBox.Item
                key={option.id}
                id={option.id}
                textValue={option.label}
                isDisabled={option.isDisabled === true}
                className="starci-core-list-option"
                data-grammar-option="true"
            >
                <span className="starci-core-list-option-copy">
                    <span className="starci-core-list-option-label">{option.label}</span>
                    {option.description == null ? null : (
                        <span className="starci-core-list-option-description">{option.description}</span>
                    )}
                </span>
                <HeroListBox.ItemIndicator />
            </HeroListBox.Item>
        ))}
    </>
)

/*
 * Consumer hook: `starci-core-select` names this control's root for a consumer or family
 * stylesheet. No shipped sheet paints it: the root is drawn as a whole by `.starci-core-field`, so
 * a rule on the hook adds to the shared anatomy and never has to replace it.
 */

/*
 * Consumer hooks: `starci-core-select-indicator`, `starci-core-list-popover`, `starci-core-list`
 * name HeroUI parts whose vendor paint Common leaves as it is. No shipped sheet paints them; the
 * Grammar name lets a consumer or family select those parts without reaching for vendor class
 * names.
 */

/**
 * A single choice from a closed list, opened from a field-shaped trigger.
 *
 * Keyboard, typeahead, listbox semantics and focus return are the vendor's. Read-only keeps the
 * trigger focusable and announced but holds the value and never opens the list; the vendor select
 * has no read-only mode of its own.
 */
export const Select = ({
    options,
    placeholder,
    value,
    defaultValue,
    onValueChange,
    isPending = false,
    ...field
}: SelectProps) => {
    const [heldValue] = useState<string | null>(value ?? defaultValue ?? null)
    const { anchor, portalProps } = useGrammarPortal()
    const readOnly = field.isReadOnly === true
    const selection = readOnly
        ? { value: value === undefined ? heldValue : value }
        : value === undefined ? defaultValue === undefined ? {} : { defaultValue } : { value }

    return (
        <HeroSelect
            data-tier="branch"
            data-component="Select"
            data-contract="A11Y-1 FIELD-3 STATE-6 CONTROL-STATE-2"
            className="starci-core-field starci-core-select"
            fullWidth
            {...vendorFieldProps({ ...field, isPending })}
            {...(placeholder === undefined ? {} : { placeholder })}
            {...selection}
            {...(readOnly ? { isOpen: false } : {})}
            onChange={(key: Key | null) => {
                if (!readOnly) onValueChange?.(toValue(key))
            }}
        >
            {anchor}
            <FieldLabel isHidden={field.isLabelHidden} isRequired={field.isRequired}>{field.label}</FieldLabel>
            <HeroSelect.Trigger
                className="starci-core-select-trigger"
                data-grammar-field-control="true"
                isPending={isPending}
            >
                <HeroSelect.Value className="starci-core-select-value" />
                {isPending
                    ? <HeroSpinner size="sm" color="current" aria-hidden="true" className="starci-core-field-spinner" />
                    : <HeroSelect.Indicator className="starci-core-select-indicator" />}
            </HeroSelect.Trigger>
            <FieldDescription>{field.description}</FieldDescription>
            <FieldErrorText>{field.errorMessage}</FieldErrorText>
            <HeroSelect.Popover className="starci-core-list-popover" data-grammar-popover="Select" data-contract="LAYOUT-4" {...portalProps}>
                <HeroListBox className="starci-core-list">
                    <ListOptions options={options} />
                </HeroListBox>
            </HeroSelect.Popover>
        </HeroSelect>
    )
}
