"use client"

import { ShopErrorPage } from "../../features/pages/ShopErrorPage"

type ErrorProps = { readonly reset: () => void }

/** The locale segment's error boundary slot: it mounts the error page and hands it the segment's retry. */
const Error = (props: ErrorProps) => <ShopErrorPage onRetry={props.reset} />

export default Error
