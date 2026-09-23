"use client"

import { SearchField as HeroSearchField, Spinner as HeroSpinner } from "@heroui/react"
import {
    FieldDescription,
    FieldErrorText,
    FieldLabel,
    vendorFieldProps,
    type FieldControlProps,
} from "../Field/index.js"

export type SearchFieldProps = FieldControlProps & {
    readonly id?: string
    readonly placeholder?: string
    readonly value?: string
    readonly defaultValue?: string
    readonly onValueChange?: (value: string) => void
    /** Enter in the field. */
    readonly onSubmit?: (value: string) => void
    /** The clear button or Escape emptied the field. */
    readonly onClear?: () => void
    /** Results for the current query are loading. The field stays editable. */
    readonly isPending?: boolean
    /** Accessible name of the clear button. Pass the app's localized "clear" copy. */
    readonly clearLabel?: string
}

/**
 * A text field whose job is a query: `type="search"`, a clear button, Escape to clear, Enter to
 * submit - all the vendor's. The leading glyph is decoration; the label is the name.
 */
export const SearchField = ({
    id,
    placeholder,
    value,
    defaultValue,
    onValueChange,
    onSubmit,
    onClear,
    isPending = false,
    clearLabel,
    ...field
}: SearchFieldProps) => (
    <HeroSearchField
        data-tier="atom"
        data-component="SearchField"
        className="starci-core-field starci-core-search-field"
        fullWidth
        {...vendorFieldProps({ ...field, isPending })}
        isReadOnly={field.isReadOnly === true}
        {...(value === undefined ? defaultValue === undefined ? {} : { defaultValue } : { value })}
        {...(onValueChange === undefined ? {} : { onChange: onValueChange })}
        {...(onSubmit === undefined ? {} : { onSubmit })}
        {...(onClear === undefined ? {} : { onClear })}
    >
        <FieldLabel isHidden={field.isLabelHidden} isRequired={field.isRequired}>{field.label}</FieldLabel>
        <HeroSearchField.Group className="starci-core-search-field-group" data-grammar-field-control="true">
            <HeroSearchField.SearchIcon aria-hidden="true" />
            <HeroSearchField.Input
                {...(id === undefined ? {} : { id })}
                {...(placeholder === undefined ? {} : { placeholder })}
                className="starci-core-search-field-input"
                {...(isPending ? { "aria-busy": true } : {})}
            />
            {isPending ? <HeroSpinner size="sm" color="current" aria-hidden="true" className="starci-core-field-spinner" /> : null}
            <HeroSearchField.ClearButton
                className="starci-core-search-field-clear"
                {...(clearLabel === undefined ? {} : { "aria-label": clearLabel })}
            />
        </HeroSearchField.Group>
        <FieldDescription>{field.description}</FieldDescription>
        <FieldErrorText>{field.errorMessage}</FieldErrorText>
    </HeroSearchField>
)
