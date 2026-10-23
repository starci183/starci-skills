import * as React from "react"
import { Card as HeroCard } from "@heroui/react"
import { cn } from "@/lib/utils"

type CardProps = Omit<React.ComponentProps<typeof HeroCard>, "className"> & { className?: string | undefined; size?: "default" | "sm"; inset?: "default" | "none" }

const Card = ({ className, size = "default", inset = "default", children, ...props }: CardProps) => {
  return <HeroCard data-size={size} className={cn("min-w-0", inset === "none" ? "p-0" : "p-4 min-[760px]:p-6", className)} {...props}>{children}</HeroCard>
};

const CardHeader = (props: React.ComponentProps<typeof HeroCard.Header>) => {
  return <HeroCard.Header {...props} />
};

const CardTitle = ({ children, ...props }: React.ComponentProps<typeof HeroCard.Title<"h3">>) => {
  // Existing callers supply their own heading level; retain it through HeroUI's render API.
  if (React.isValidElement<React.ComponentProps<"h2">>(children) && typeof children.type === "string" && /^h[1-6]$/.test(children.type)) {
    const Heading = children.type as "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
    return <HeroCard.Title<typeof Heading> {...props} render={headingProps => <Heading {...headingProps} {...children.props} className={cn(headingProps.className, children.props.className)} />} />
  }
  return <HeroCard.Title {...props}>{children}</HeroCard.Title>
};

const CardDescription = (props: React.ComponentProps<typeof HeroCard.Description>) => {
  return <HeroCard.Description {...props} />
};

const CardAction = (props: React.ComponentProps<typeof HeroCard.Footer>) => {
  return <HeroCard.Footer data-slot="card-action" {...props} />
};

type CardContentProps = Omit<React.ComponentProps<typeof HeroCard.Content>, "className"> & { className?: string | undefined }

const CardContent = ({ className, ...props }: CardContentProps) => {
  return <HeroCard.Content className={cn("min-w-0", className)} {...props} />
};

const CardFooter = (props: React.ComponentProps<typeof HeroCard.Footer>) => {
  return <HeroCard.Footer {...props} />
};

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent }
