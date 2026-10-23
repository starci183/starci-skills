import * as React from "react"
import { Tooltip as HeroTooltip } from "@heroui/react"
import { cn } from "@/lib/utils"
import { Button, type ButtonControlProps } from "./button"

const DelayContext = React.createContext(0)

const TooltipProvider = ({ delayDuration = 0, children }: Readonly<{ delayDuration?: number; children?: React.ReactNode }>) => {
  return <DelayContext value={delayDuration}>{children}</DelayContext>
};

type TooltipProps = Omit<React.ComponentProps<typeof HeroTooltip.Root>, "isOpen" | "delay"> & { open?: boolean; delayDuration?: number }

const Tooltip = ({ open, delayDuration, ...props }: TooltipProps) => {
  const delay = React.useContext(DelayContext)
  return <HeroTooltip.Root {...(open === undefined ? {} : { isOpen: open })} delay={delayDuration ?? delay} {...props} />
};

type TooltipTriggerProps = Omit<ButtonControlProps, "asChild"> & { asChild?: boolean }

const TooltipTrigger = ({ asChild = false, children, ...props }: TooltipTriggerProps) => {
  // A HeroUI Button or Link reads the vendor's focus/hover context without cloning.
  if (asChild) return <>{children}</>
  return <Button data-ui="tooltip-trigger" {...props}>{children}</Button>
};

type TooltipContentProps = React.ComponentProps<typeof HeroTooltip.Content> & {
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
  sideOffset?: number
  hidden?: boolean
}

/** The cross-axis alignment a side-and-align pair resolves to: a vertical edge aligns top or bottom, a horizontal one keeps the requested alignment. */
const crossAlignment = (side: NonNullable<TooltipContentProps["side"]>, align: NonNullable<TooltipContentProps["align"]>) => {
  if (side !== "left" && side !== "right") return align
  return align === "start" ? "top" : "bottom"
}

const TooltipContent = ({ className, side = "top", align = "center", sideOffset, children, hidden, placement, offset, showArrow = true, ...props }: TooltipContentProps) => {
  const alignment = crossAlignment(side, align)
  const resolvedPlacement = align === 'center' ? side : `${side} ${alignment}` as NonNullable<React.ComponentProps<typeof HeroTooltip.Content>['placement']>
  const distance = offset ?? sideOffset
  if (hidden) return null
  return <HeroTooltip.Content data-ui="tooltip-content" placement={placement ?? resolvedPlacement}
    {...(distance === undefined ? {} : { offset: distance })} showArrow={showArrow} className={cn("max-w-xs text-xs", className)} {...props}>
    {children}{showArrow && <HeroTooltip.Arrow />}
  </HeroTooltip.Content>
};

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
