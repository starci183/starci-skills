"use client"

import {
    ComboBox as HeroComboBox,
    Input as HeroInput,
    ListBox as HeroListBox,
    Spinner as HeroSpinner,
    type Key,
} from "@heroui/react"
import type { ReactNode } from "react"
import {
    FieldDescription,
    FieldErrorText,
    FieldLabel,
    useGrammarPortal,
    vendorFieldProps,
    type FieldControlProps,
} from "../../primitive/Field/index.js"
import { ListOptions, type ListOption } from "../Select/index.js"

export type ComboBoxProps = FieldControlProps & {
    readonly id?: string
    readonly options: ReadonlyArray<ListOption>
    readonly placeholder?: string
    /** Selected option id. */
    readonly value?: string | null
    readonly defaultValue?: string | null
    readonly onValueChange?: (value: string | null) => void
    /** Typed text. Control it to filter or fetch options yourself. */
    readonly inputValue?: string
    readonly defaultInputValue?: string
    readonly onInputChange?: (value: string) => void
    /** Keeps typed text that matches no option as the field value (autocomplete / free entry). */
    readonly allowsCustomValue?: boolean
    /** Shown inside the open list when nothing matches. The copy is the app's. */
    readonly emptyState?: ReactNode
    /** Options are being fetched for the typed text. */
    readonly isPending?: boolean
    /** When the list opens: while typing (default), on focus, or only from the trigger/arrow keys. */
    readonly menuTrigger?: "input" | "focus" | "manual"
}

/**
 * Type to filter a list, then pick (combobox / autocomplete).
 *
 * The vendor owns the combobox role, `aria-expanded`, `aria-activedescendant`, arrow/Enter/Escape
 * handling and the "contains" filter. Pending keeps the input editable and marks the list busy.
 */
export const ComboBox = ({
    id,
    options,
    placeholder,
    value,
    defaultValue,
    onValueChange,
    inputValue,
    defaultInputValue,
    onInputChange,
    allowsCustomValue = false,
    emptyState,
    isPending = false,
    menuTrigger = "input",
    ...field
}: ComboBoxProps) => {
    const { anchor, portalProps } = useGrammarPortal()
    return (
        <HeroComboBox
            data-tier="branch"
            data-component="ComboBox"
            className="starci-core-field starci-core-combo-box"
            fullWidth
            {...vendorFieldProps({ ...field, isPending })}
            isReadOnly={field.isReadOnly === true}
            allowsCustomValue={allowsCustomValue}
            menuTrigger={menuTrigger}
            {...(value === undefined ? defaultValue === undefined ? {} : { defaultValue } : { value })}
            {...(inputValue === undefined ? defaultInputValue === undefined ? {} : { defaultInputValue } : { inputValue })}
            {...(onInputChange === undefined ? {} : { onInputChange })}
            onChange={(key: Key | null) => onValueChange?.(key === null ? null : String(key))}
        >
            {anchor}
            <FieldLabel isHidden={field.isLabelHidden} isRequired={field.isRequired}>{field.label}</FieldLabel>
            <HeroComboBox.InputGroup className="starci-core-combo-box-group" data-grammar-field-control="true">
                <HeroInput
                    {...(id === undefined ? {} : { id })}
                    {...(placeholder === undefined ? {} : { placeholder })}
                    className="starci-core-combo-box-input"
                    {...(isPending ? { "aria-busy": true } : {})}
                />
                <HeroComboBox.Trigger className="starci-core-combo-box-trigger">
                    {isPending ? <HeroSpinner size="sm" color="current" aria-hidden="true" className="starci-core-field-spinner" /> : undefined}
                </HeroComboBox.Trigger>
            </HeroComboBox.InputGroup>
            <FieldDescription>{field.description}</FieldDescription>
            <FieldErrorText>{field.errorMessage}</FieldErrorText>
            <HeroComboBox.Popover className="starci-core-list-popover" data-grammar-popover="ComboBox" {...portalProps}>
                <HeroListBox
                    className="starci-core-list"
                    {...(isPending ? { "aria-busy": true } : {})}
                    {...(emptyState == null ? {} : {
                        renderEmptyState: () => <div className="starci-core-list-empty" data-grammar-list-empty="true">{emptyState}</div>,
                    })}
                >
                    <ListOptions options={options} />
                </HeroListBox>
            </HeroComboBox.Popover>
        </HeroComboBox>
    )
}
