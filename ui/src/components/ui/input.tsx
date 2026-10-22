import * as React from "react"
import { Input as HeroInput } from "@heroui/react"
import { cn } from "@/lib/utils"

const Input = ({ className, ...props }: React.ComponentProps<typeof HeroInput>) => {
  return <HeroInput fullWidth className={cn("min-w-0", className)} {...props} />
};

export { Input }
