import * as React from "react"
import { Tooltip as HeroTooltip } from "@heroui/react"
import { cn } from "@/lib/utils"

const DelayContext = React.createContext(0)

function TooltipProvider({ delayDuration = 0, children }: { delayDuration?: number; children?: React.ReactNode }) {
  return <DelayContext value={delayDuration}>{children}</DelayContext>
}

function Tooltip({ open, delayDuration, ...props }:
  Omit<React.ComponentProps<typeof HeroTooltip.Root>, "isOpen" | "delay"> & { open?: boolean; delayDuration?: number }) {
  const delay = React.useContext(DelayContext)
  return <HeroTooltip.Root isOpen={open} delay={delayDuration ?? delay} {...props} />
}

function TooltipTrigger({ asChild = false, children, ...props }:
  React.ComponentProps<"button"> & { asChild?: boolean }) {
  // A HeroUI Button or Link reads the vendor's focus/hover context without cloning.
  if (asChild) return <>{children}</>
  return <HeroTooltip.Trigger<"button"> data-ui="tooltip-trigger" {...props}
    render={triggerProps => <button {...triggerProps} type={props.type ?? "button"} />}>
    {children}
  </HeroTooltip.Trigger>
}

function TooltipContent({ className, side = "top", align = "center", sideOffset, children, hidden, placement, offset, showArrow = true, ...props }:
  React.ComponentProps<typeof HeroTooltip.Content> & {
    side?: "top" | "right" | "bottom" | "left"
    align?: "start" | "center" | "end"
    sideOffset?: number
    hidden?: boolean
  }) {
  const alignment = side === 'left' || side === 'right' ? align === 'start' ? 'top' : 'bottom' : align
  const resolvedPlacement = align === 'center' ? side : `${side} ${alignment}` as NonNullable<React.ComponentProps<typeof HeroTooltip.Content>['placement']>
  if (hidden) return null
  return <HeroTooltip.Content data-ui="tooltip-content" placement={placement ?? resolvedPlacement}
    offset={offset ?? sideOffset} showArrow={showArrow} className={cn("max-w-xs text-xs", className)} {...props}>
    {children}{showArrow && <HeroTooltip.Arrow />}
  </HeroTooltip.Content>
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
