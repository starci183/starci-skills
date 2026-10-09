import * as React from "react"
import { Button as HeroButton, Link as HeroLink, buttonVariants as heroButtonVariants, type ButtonProps as HeroButtonProps, type LinkProps as HeroLinkProps } from "@heroui/react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const compatibilityVariants = cva("group/button", {
  variants: {
    variant: { default: "", outline: "", secondary: "", ghost: "", destructive: "", link: "underline-offset-4 hover:underline" },
    size: { default: "", xs: "text-xs", sm: "", lg: "", icon: "", "icon-xs": "", "icon-sm": "", "icon-lg": "" },
  },
  defaultVariants: { variant: "default", size: "default" },
})

type CompatibilityVariants = VariantProps<typeof compatibilityVariants>
type CompatibilityProps = CompatibilityVariants & {
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
  title?: string
}
type ButtonControlProps = Omit<HeroButtonProps, "variant" | "size" | "className" | "style"> & CompatibilityProps & { asChild?: false }
type ButtonLinkProps = Omit<HeroLinkProps, "children" | "className" | "style"> & CompatibilityProps & {
  asChild: true
  children: React.ReactElement<React.ComponentProps<"a">>
  isIconOnly?: boolean
  fullWidth?: boolean
  type?: HeroButtonProps["type"]
}
type ButtonProps = ButtonControlProps | ButtonLinkProps

// Native anchor callbacks retain their actual element while HeroUI owns link interactions.
function nativeLinkProps({ onFocus, onBlur, onKeyDown, onKeyUp, onClick, ...props }: React.ComponentProps<"a">): HeroLinkProps {
  return {
    ...props,
    onFocus: onFocus ? event => onFocus(event as React.FocusEvent<HTMLAnchorElement>) : undefined,
    onBlur: onBlur ? event => onBlur(event as React.FocusEvent<HTMLAnchorElement>) : undefined,
    onKeyDown: onKeyDown ? event => onKeyDown(event as React.KeyboardEvent<HTMLAnchorElement>) : undefined,
    onKeyUp: onKeyUp ? event => onKeyUp(event as React.KeyboardEvent<HTMLAnchorElement>) : undefined,
    onClick: onClick ? event => onClick(event as React.MouseEvent<HTMLAnchorElement>) : undefined,
  }
}

function vendorVariant(variant: CompatibilityVariants["variant"]): HeroButtonProps["variant"] {
  if (variant === "default" || !variant) return "primary"
  if (variant === "destructive") return "danger-soft"
  if (variant === "link") return "ghost"
  return variant
}

function vendorSize(size: CompatibilityVariants["size"]): HeroButtonProps["size"] {
  if (size === "lg" || size === "icon-lg") return "lg"
  if (size === "xs" || size === "sm" || size === "icon-xs" || size === "icon-sm") return "sm"
  return "md"
}

function buttonVariants({ variant = "default", size = "default", className, fullWidth, isIconOnly }: CompatibilityVariants & { className?: string; fullWidth?: boolean; isIconOnly?: boolean } = {}) {
  return cn(heroButtonVariants({ variant: vendorVariant(variant), size: vendorSize(size), fullWidth, isIconOnly: isIconOnly ?? size?.startsWith("icon") }), compatibilityVariants({ variant, size }), className)
}

function Button(buttonProps: ButtonProps) {
  if (buttonProps.asChild) {
    const { className, variant = "default", size = "default", asChild, disabled, isDisabled, isIconOnly, fullWidth, onClick, children, type, ...props } = buttonProps
    const { children: linkChildren, className: linkClassName, onClick: linkClick, ...linkProps } = children.props
    return <HeroLink
      {...nativeLinkProps(linkProps)}
      {...props}
      isDisabled={isDisabled ?? disabled}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, fullWidth, isIconOnly }), "no-underline", className, linkClassName)}
      onClick={event => {
        linkClick?.(event as React.MouseEvent<HTMLAnchorElement>)
        onClick?.(event)
      }}
    >{linkChildren}</HeroLink>
  }
  const { className, variant = "default", size = "default", asChild, disabled, isDisabled, isIconOnly, onClick, children, type = "button", ...props } = buttonProps
  return <HeroButton
    {...props}
    type={type}
    isDisabled={isDisabled ?? disabled}
    variant={vendorVariant(variant)}
    size={vendorSize(size)}
    isIconOnly={isIconOnly ?? size?.startsWith("icon")}
    data-slot="button"
    data-variant={variant}
    data-size={size}
    className={cn(compatibilityVariants({ variant, size }), className)}
    onClick={onClick}
  >{children}</HeroButton>
}

export { Button, buttonVariants, nativeLinkProps }
export type { ButtonProps, ButtonControlProps, ButtonLinkProps }
