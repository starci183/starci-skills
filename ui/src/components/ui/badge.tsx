import * as React from "react"
import { Chip } from "@heroui/react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva("group/badge whitespace-nowrap [&>svg]:size-3 [&>svg]:shrink-0", {
  variants: {
    variant: { default: "", secondary: "", destructive: "", outline: "", ghost: "", link: "underline-offset-4 hover:underline" },
  },
  defaultVariants: { variant: "default" },
})

type BadgeProps = React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>

/** The HeroUI chip variant each badge variant is drawn with. */
const chipVariantOf = (variant: BadgeProps["variant"]): "primary" | "soft" | "secondary" | "tertiary" => {
  if (variant === "default") return "primary"
  if (variant === "secondary" || variant === "destructive") return "soft"
  if (variant === "outline") return "secondary"
  return "tertiary"
}

/** The HeroUI chip colour each badge variant is drawn with. */
const chipColorOf = (variant: BadgeProps["variant"]): "accent" | "danger" | "default" => {
  if (variant === "default" || variant === "link") return "accent"
  if (variant === "destructive") return "danger"
  return "default"
}

const Badge = ({ className, variant = "default", children, ...props }: BadgeProps) => {
  const chipVariant = chipVariantOf(variant)
  const color = chipColorOf(variant)
  const classes = cn(badgeVariants({ variant }), className)
  return <Chip {...props} color={color} variant={chipVariant} size="sm" data-variant={variant} className={classes}><Chip.Label className="inline-flex items-center gap-1.5">{children}</Chip.Label></Chip>
};

export { Badge, badgeVariants }
