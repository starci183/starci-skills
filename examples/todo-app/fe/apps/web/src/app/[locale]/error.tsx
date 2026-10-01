"use client"

import { ErrorPage } from "@/features/pages/ErrorPage"

type ErrorProps = { readonly reset: () => void }

/** The locale segment's error boundary slot: it mounts the error page and hands it the segment's retry. */
const ErrorBoundary = (props: ErrorProps) => <ErrorPage onRetry={props.reset} />

export default ErrorBoundary
