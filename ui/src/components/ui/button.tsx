import * as React from "react"
import { Button as HeroButton, type ButtonProps as HeroButtonProps } from "@heroui/react"
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
type ButtonControlProps = Omit<HeroButtonProps, "variant" | "size" | "className" | "style"> & CompatibilityProps

const vendorVariant = (variant: CompatibilityVariants["variant"]): NonNullable<HeroButtonProps["variant"]> => {
  if (variant === "default" || !variant) return "primary"
  if (variant === "destructive") return "danger-soft"
  if (variant === "link") return "ghost"
  return variant
};

const vendorSize = (size: CompatibilityVariants["size"]): NonNullable<HeroButtonProps["size"]> => {
  if (size === "lg" || size === "icon-lg") return "lg"
  if (size === "xs" || size === "sm" || size === "icon-xs" || size === "icon-sm") return "sm"
  return "md"
};

const Button = ({ className, variant = "default", size = "default", disabled, isDisabled, isIconOnly, onClick, children, type = "button", ...props }: ButtonControlProps) => {
  const unavailable = isDisabled ?? disabled
  const iconOnly = isIconOnly ?? size?.startsWith("icon")
  return <HeroButton
    {...props}
    type={type}
    {...(unavailable === undefined ? {} : { isDisabled: unavailable })}
    variant={vendorVariant(variant)}
    size={vendorSize(size)}
    {...(iconOnly === undefined ? {} : { isIconOnly: iconOnly })}
    data-slot="button"
    data-variant={variant}
    data-size={size}
    className={cn(compatibilityVariants({ variant, size }), className)}
    {...(onClick === undefined ? {} : { onClick })}
  >{children}</HeroButton>
};

export { Button }
export type { ButtonControlProps }
