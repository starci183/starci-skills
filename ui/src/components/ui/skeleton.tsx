import * as React from "react"
import { Skeleton as HeroSkeleton } from "@heroui/react"

function Skeleton(props: React.ComponentProps<"div">) {
  return <HeroSkeleton animationType="pulse" aria-hidden="true" {...props} />
}

export { Skeleton }
