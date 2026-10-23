import * as React from "react"
import { TextArea as HeroTextArea } from "@heroui/react"
import { cn } from "@/lib/utils"

const Textarea = ({ className, ...props }: React.ComponentProps<typeof HeroTextArea>) => {
  return <HeroTextArea fullWidth className={cn("min-h-16", className)} {...props} />
};

export { Textarea }
