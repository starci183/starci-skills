import * as React from "react"
import { Separator as HeroSeparator } from "@heroui/react"

type SeparatorProps = React.ComponentProps<typeof HeroSeparator> & { decorative?: boolean }

const Separator = ({ orientation = "horizontal", decorative = true, ...props }: SeparatorProps) => {
  return <HeroSeparator orientation={orientation} aria-hidden={decorative || undefined} {...props} />
};

export { Separator }
