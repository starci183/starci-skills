import * as React from "react"
import { Card as HeroCard } from "@heroui/react"
import { cn } from "@/lib/utils"

function Card({ className, size = "default", inset = "default", variant, children, ...props }: React.ComponentProps<"div"> & { size?: "default" | "sm"; inset?: "default" | "none"; variant?: React.ComponentProps<typeof HeroCard>["variant"] }) {
  return <HeroCard variant={variant} data-size={size} className={cn("min-w-0", inset === "none" ? "p-0" : "p-4 min-[760px]:p-6", className)} {...props}>{children}</HeroCard>
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <HeroCard.Header className={className} {...props} />
}

function CardTitle({ className, children, ...props }: React.ComponentProps<"div">) {
  // Existing callers supply their own heading level; retain it through HeroUI's render API.
  if (React.isValidElement<React.ComponentProps<"h2">>(children) && typeof children.type === "string" && /^h[1-6]$/.test(children.type)) {
    const Heading = children.type as "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
    return <HeroCard.Title<typeof Heading> {...props} className={className} render={headingProps => <Heading {...headingProps} {...children.props} className={cn(headingProps.className, children.props.className)} />} />
  }
  return <HeroCard.Title {...props} className={className}>{children}</HeroCard.Title>
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <HeroCard.Description className={className} {...props} />
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return <HeroCard.Footer data-slot="card-action" className={className} {...props} />
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <HeroCard.Content className={cn("min-w-0", className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <HeroCard.Footer className={className} {...props} />
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent }
