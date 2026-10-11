import * as React from "react"
import { Separator as HeroSeparator } from "@heroui/react"

function Separator({ orientation = "horizontal", decorative = true, ...props }: React.ComponentProps<typeof HeroSeparator> & { decorative?: boolean }) {
  return <HeroSeparator orientation={orientation} aria-hidden={decorative || undefined} {...props} />
}

export { Separator }
