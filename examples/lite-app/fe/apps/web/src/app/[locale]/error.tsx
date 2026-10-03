"use client"

import { AppErrorPage } from "@/features/pages/AppErrorPage"

type ErrorProps = { readonly reset: () => void }

/** The locale segment's error boundary slot. */
const ErrorBoundary = (props: ErrorProps) => <AppErrorPage onRetry={props.reset} />

export default ErrorBoundary
