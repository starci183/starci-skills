import { Checkbox as HeroCheckbox, Label } from "@heroui/react"
import type * as React from "react"

type CheckboxProps = Readonly<
  Omit<React.ComponentProps<typeof HeroCheckbox>, "children"> & {
    checked?: boolean
    defaultChecked?: boolean
    onCheckedChange?: (checked: boolean) => void
    disabled?: boolean
    required?: boolean
    children?: React.ReactNode
  }
>

/** HeroUI checkbox with boolean compatibility props and an optional integrated label. */
function Checkbox({
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  required,
  children,
  isSelected,
  defaultSelected,
  onChange,
  isDisabled,
  isRequired,
  ...props
}: CheckboxProps) {
  return (
    <HeroCheckbox
      {...props}
      isSelected={checked ?? isSelected}
      defaultSelected={defaultChecked ?? defaultSelected}
      onChange={onCheckedChange ?? onChange}
      isDisabled={disabled ?? isDisabled}
      isRequired={required ?? isRequired}
    >
      <HeroCheckbox.Content>
        <HeroCheckbox.Control>
          <HeroCheckbox.Indicator />
        </HeroCheckbox.Control>
        {children != null ? <Label>{children}</Label> : null}
      </HeroCheckbox.Content>
    </HeroCheckbox>
  )
}

export { Checkbox }
