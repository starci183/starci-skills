import * as React from "react"
import { Chip, Link as HeroLink } from "@heroui/react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { nativeLinkProps } from "./button"

const badgeVariants = cva("group/badge whitespace-nowrap [&>svg]:size-3 [&>svg]:shrink-0", {
  variants: {
    variant: { default: "", secondary: "", destructive: "", outline: "", ghost: "", link: "underline-offset-4 hover:underline" },
  },
  defaultVariants: { variant: "default" },
})

function Badge({ className, variant = "default", asChild = false, children, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const chipVariant = variant === "default" ? "primary" : variant === "secondary" || variant === "destructive" ? "soft" : variant === "outline" ? "secondary" : "tertiary"
  const color = variant === "default" || variant === "link" ? "accent" : variant === "destructive" ? "danger" : "default"
  const classes = cn(badgeVariants({ variant }), className)
  if (asChild && React.isValidElement<React.ComponentProps<"a">>(children) && children.type === "a") {
    const { children: linkChildren, ...linkProps } = children.props
    return <Chip<"a"> color={color} variant={chipVariant} size="sm" className={classes} render={chipProps => <HeroLink {...nativeLinkProps({ ...chipProps, ...linkProps })} className={cn(chipProps.className, linkProps.className)} />}><Chip.Label className="inline-flex items-center gap-1.5">{linkChildren}</Chip.Label></Chip>
  }
  return <Chip {...props} color={color} variant={chipVariant} size="sm" data-variant={variant} className={classes}><Chip.Label className="inline-flex items-center gap-1.5">{children}</Chip.Label></Chip>
}

export { Badge, badgeVariants }
