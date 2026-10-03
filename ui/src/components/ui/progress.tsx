
import * as React from "react"
import { cn } from "@/lib/utils"
import { Progress as ProgressPrimitive } from "radix-ui"
import type { Tone } from "../status"

function Progress({
  className,
  value = null,
  tone,
  max = 100,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & { tone?: Tone }) {
  const hasMaximum = Number.isFinite(max) && max > 0
  const maximum = hasMaximum ? max : 100
  const bounded = hasMaximum && typeof value === "number" && Number.isFinite(value)
    ? Math.min(Math.max(value, 0), maximum) : null
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      data-tone={tone}
      value={bounded}
      max={maximum}
      className={cn(
        "relative flex h-1.5 w-full items-center overflow-x-hidden rounded-full bg-muted",
        tone && "progress-tone",
        className
      )}
      {...props}
      aria-valuenow={bounded ?? undefined}
    >
      {bounded != null && <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="size-full flex-1 bg-primary transition-all"
        style={{ transform: `translateX(-${100 - bounded / maximum * 100}%)` }}
      />}
    </ProgressPrimitive.Root>
  )
}

export { Progress }
