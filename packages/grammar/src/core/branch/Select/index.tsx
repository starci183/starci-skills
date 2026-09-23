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
            <HeroSelect.Popover className="starci-core-list-popover" data-grammar-popover="Select" {...portalProps}>
                <HeroListBox className="starci-core-list">
                    <ListOptions options={options} />
                </HeroListBox>
            </HeroSelect.Popover>
        </HeroSelect>
    )
}
