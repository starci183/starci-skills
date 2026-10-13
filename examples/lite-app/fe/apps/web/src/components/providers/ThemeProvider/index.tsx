"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { ReactNode } from "react"

/** Light and dark through the `.light` / `.dark` class the grammar and the brand layer read; the system theme by default. */
export const ThemeProvider = (props: { readonly children: ReactNode }) => (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        {props.children}
    </NextThemesProvider>
)
