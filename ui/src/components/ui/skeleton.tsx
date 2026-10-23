import * as React from "react"
import { Skeleton as HeroSkeleton } from "@heroui/react"

const Skeleton = (props: React.ComponentProps<typeof HeroSkeleton>) => {
  return <HeroSkeleton animationType="pulse" aria-hidden="true" {...props} />
};

export { Skeleton }
