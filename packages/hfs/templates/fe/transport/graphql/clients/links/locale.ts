import { SetContextLink } from "@apollo/client/link/context"
import { contextHeaders } from "./context-headers"

/** The language of the document the reader is on (`<html lang>`, set by the locale layout); undefined outside a browser. */
const documentLocale = (): string | undefined =>
    typeof document === "undefined" || document.documentElement.lang === "" ? undefined : document.documentElement.lang

/** The one writer of `Accept-Language`: every operation declares the language the back end answers and localizes its errors in. */
export const createAttachLocaleLink = (locale: () => string | undefined = documentLocale) =>
    new SetContextLink((context) => {
        const value = locale()
        if (value === undefined) return {}
        return { headers: { ...contextHeaders(context), "Accept-Language": value } }
    })
