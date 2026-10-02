"use client"

import { AppGlobalErrorPage } from "@/features/pages/AppGlobalErrorPage"

type GlobalErrorProps = { readonly reset: () => void }

/** The last-resort error boundary slot: it mounts the global error page and hands it the retry. */
const GlobalError = (props: GlobalErrorProps) => <AppGlobalErrorPage onRetry={props.reset} />

export default GlobalError
