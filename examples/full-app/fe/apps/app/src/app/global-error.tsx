"use client"

import { ShopGlobalErrorPage } from "../features/pages/ShopGlobalErrorPage"

type GlobalErrorProps = { readonly reset: () => void }

/** The last-resort error boundary slot: it mounts the global error page and hands it the retry. */
const GlobalError = (props: GlobalErrorProps) => <ShopGlobalErrorPage onRetry={props.reset} />

export default GlobalError
