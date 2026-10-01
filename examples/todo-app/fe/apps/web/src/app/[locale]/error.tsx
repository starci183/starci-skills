"use client"

import { ErrorPage } from "@/features/pages/ErrorPage"

type ErrorProps = { readonly reset: () => void }

/** The locale segment's error boundary slot: it mounts the error page and hands it the segment's retry. */
const Error = (props: ErrorProps) => <ErrorPage onRetry={props.reset} />

export default Error
