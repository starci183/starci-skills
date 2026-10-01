"use client"

import { GlobalErrorPage } from "@/features/pages/GlobalErrorPage"

type GlobalErrorProps = { readonly reset: () => void }

/** The last-resort error boundary slot: it mounts the global error page and hands it the retry. */
const GlobalError = (props: GlobalErrorProps) => <GlobalErrorPage onRetry={props.reset} />

export default GlobalError
