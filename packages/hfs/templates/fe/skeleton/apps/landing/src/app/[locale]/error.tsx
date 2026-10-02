"use client"

import { LandingErrorPage } from "@/features/pages/LandingErrorPage"

type ErrorProps = { readonly reset: () => void }

/** The locale segment's error boundary slot: it mounts the error page and hands it the segment's retry. */
const ErrorBoundary = (props: ErrorProps) => <LandingErrorPage onRetry={props.reset} />

export default ErrorBoundary
