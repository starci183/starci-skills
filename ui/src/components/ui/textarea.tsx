import * as React from "react"
import { TextArea as HeroTextArea } from "@heroui/react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <HeroTextArea fullWidth className={cn("min-h-16", className)} {...props} />
}

export { Textarea }
