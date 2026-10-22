"use client"

import { LandingGlobalErrorPage } from "../features/pages/LandingGlobalErrorPage"

type GlobalErrorProps = { readonly reset: () => void }

/** The last-resort error boundary slot: it mounts the global error page and hands it the retry. */
const GlobalError = (props: GlobalErrorProps) => <LandingGlobalErrorPage onRetry={props.reset} />

export default GlobalError
