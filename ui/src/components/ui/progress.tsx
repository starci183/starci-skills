import { ProgressBar, type ProgressBarProps } from "@heroui/react"
import { cn } from "@/lib/utils"
import type { Tone } from "../status"

type ProgressProps = Omit<ProgressBarProps, "value" | "maxValue" | "children" | "className"> & {
  value?: number | null
  max?: number
  tone?: Tone
  className?: string
}

function Progress({ className, value = null, tone, max = 100, ...props }: ProgressProps) {
  const hasMaximum = Number.isFinite(max) && max > 0
  const maximum = hasMaximum ? max : 100
  const bounded = hasMaximum && typeof value === "number" && Number.isFinite(value)
    ? Math.min(Math.max(value, 0), maximum) : null
  const color = tone === "success" ? "success" : tone === "failed" ? "danger" : tone === "warning" ? "warning" : tone === "skipped" ? "default" : "accent"
  return <ProgressBar
    {...props}
    value={bounded ?? undefined}
    maxValue={maximum}
    isIndeterminate={bounded == null}
    color={color}
    size="sm"
    data-tone={tone}
    className={cn("min-w-0 gap-0", tone && "[--progress-bar-fill:var(--tone)]", className)}
  ><ProgressBar.Track className="h-full min-h-1.5">{bounded != null ? <ProgressBar.Fill /> : null}</ProgressBar.Track></ProgressBar>
}

export { Progress }
