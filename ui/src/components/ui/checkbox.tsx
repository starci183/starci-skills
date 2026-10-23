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
const Checkbox = ({
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
}: CheckboxProps) => {
  const selected = checked ?? isSelected
  const initiallySelected = defaultChecked ?? defaultSelected
  const changed = onCheckedChange ?? onChange
  const unavailable = disabled ?? isDisabled
  const needed = required ?? isRequired
  return (
    <HeroCheckbox
      {...props}
      {...(selected === undefined ? {} : { isSelected: selected })}
      {...(initiallySelected === undefined ? {} : { defaultSelected: initiallySelected })}
      {...(changed === undefined ? {} : { onChange: changed })}
      {...(unavailable === undefined ? {} : { isDisabled: unavailable })}
      {...(needed === undefined ? {} : { isRequired: needed })}
    >
      <HeroCheckbox.Content>
        <HeroCheckbox.Control>
          <HeroCheckbox.Indicator />
        </HeroCheckbox.Control>
        {children != null ? <Label>{children}</Label> : null}
      </HeroCheckbox.Content>
    </HeroCheckbox>
  )
};

export { Checkbox }
