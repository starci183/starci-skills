import * as React from "react"
import { InputGroup as HeroInputGroup, Description } from "@heroui/react"
import { cn } from "@/lib/utils"
import { Button, type ButtonControlProps } from "@/components/ui/button"

function InputGroup({ className, ...props }: Omit<React.ComponentProps<typeof HeroInputGroup>, "className"> & { className?: string }) {
  return <HeroInputGroup fullWidth className={cn("group/input-group relative min-w-0 has-[[data-align=block-start]]:flex-col has-[[data-align=block-end]]:flex-col", className)} {...props} />
}

function InputGroupAddon({ className, align = "inline-start", ...props }: React.ComponentProps<"div"> & { align?: "inline-start" | "inline-end" | "block-start" | "block-end" }) {
  const Addon = align === "inline-end" || align === "block-end" ? HeroInputGroup.Suffix : HeroInputGroup.Prefix
  return <Addon data-align={align} className={cn("gap-2 text-sm [&>svg]:size-4", align.endsWith("start") ? "order-first" : "order-last", align.startsWith("block") && "w-full justify-start border-0 py-2", className)} {...props} />
}

function InputGroupButton({ className, type = "button", variant = "ghost", size = "xs", ...props }: Omit<ButtonControlProps, "size"> & { size?: "xs" | "sm" | "icon-xs" | "icon-sm" }) {
  return <Button type={type} size={size} variant={variant} className={className} {...props} />
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return <Description className={cn("flex items-center gap-2 text-sm [&_svg]:size-4", className)} {...props} />
}

function InputGroupInput({ className, ...props }: React.ComponentProps<"input">) {
  return <HeroInputGroup.Input className={cn("min-w-0", className)} {...props} />
}

function InputGroupTextarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <HeroInputGroup.TextArea className={cn("min-w-0 resize-none", className)} {...props} />
}

export { InputGroup, InputGroupAddon, InputGroupButton, InputGroupText, InputGroupInput, InputGroupTextarea }
