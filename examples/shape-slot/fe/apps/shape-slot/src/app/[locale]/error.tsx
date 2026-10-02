"use client"

import { ErrorPage } from "@/features/pages/ErrorPage"

/** Route input of the locale error slot. */
type ErrorPageProps = { readonly reset: () => void }

/** Route adapter: the boundary mounts the error page and hands it the segment's retry. */
const ErrorBoundary = (props: ErrorPageProps) => <ErrorPage onRetry={props.reset} />

export default ErrorBoundary
