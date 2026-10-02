"use client"

import { GlobalErrorPage } from "@/features/pages/GlobalErrorPage"

/** Route input of the root error slot. */
type GlobalErrorProps = { readonly reset: () => void }

/** Route adapter: the boundary mounts the global error page and hands it the retry. */
const GlobalError = (props: GlobalErrorProps) => <GlobalErrorPage onRetry={props.reset} />

export default GlobalError
