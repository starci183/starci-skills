import * as React from "react"
import { InputGroup as HeroInputGroup, Description } from "@heroui/react"
import { cn } from "@/lib/utils"
import { Button, type ButtonControlProps } from "@/components/ui/button"

type InputGroupProps = Omit<React.ComponentProps<typeof HeroInputGroup>, "className"> & { className?: string }

const InputGroup = ({ className, ...props }: InputGroupProps) => {
  return <HeroInputGroup fullWidth className={cn("group/input-group relative min-w-0 has-[[data-align=block-start]]:flex-col has-[[data-align=block-end]]:flex-col", className)} {...props} />
};

type InputGroupAddonProps = React.ComponentProps<"div"> & { align?: "inline-start" | "inline-end" | "block-start" | "block-end" }

const InputGroupAddon = ({ className, align = "inline-start", ...props }: InputGroupAddonProps) => {
  const Addon = align === "inline-end" || align === "block-end" ? HeroInputGroup.Suffix : HeroInputGroup.Prefix
  return <Addon data-align={align} className={cn("gap-2 text-sm [&>svg]:size-4", align.endsWith("start") ? "order-first" : "order-last", align.startsWith("block") && "w-full justify-start border-0 py-2", className)} {...props} />
};

type InputGroupButtonProps = Omit<ButtonControlProps, "size"> & { size?: "xs" | "sm" | "icon-xs" | "icon-sm" }

const InputGroupButton = ({ type = "button", variant = "ghost", size = "xs", ...props }: InputGroupButtonProps) => {
  return <Button type={type} size={size} variant={variant} {...props} />
};

const InputGroupText = ({ className, ...props }: React.ComponentProps<"span">) => {
  return <Description className={cn("flex items-center gap-2 text-sm [&_svg]:size-4", className)} {...props} />
};

const InputGroupInput = ({ className, ...props }: React.ComponentProps<typeof HeroInputGroup.Input>) => {
  return <HeroInputGroup.Input className={cn("min-w-0", className)} {...props} />
};

const InputGroupTextarea = ({ className, ...props }: React.ComponentProps<typeof HeroInputGroup.TextArea>) => {
  return <HeroInputGroup.TextArea className={cn("min-w-0 resize-none", className)} {...props} />
};

export { InputGroup, InputGroupAddon, InputGroupButton, InputGroupText, InputGroupInput, InputGroupTextarea }
