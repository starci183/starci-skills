import * as React from "react"
import { Input as HeroInput } from "@heroui/react"
import { cn } from "@/lib/utils"

function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <HeroInput fullWidth className={cn("min-w-0", className)} {...props} />
}

export { Input }
