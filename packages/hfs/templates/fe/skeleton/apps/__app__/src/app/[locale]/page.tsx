import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"

interface HomePageProps {
    readonly params: Promise<{ readonly locale: string }>
}

/** The document title comes from the catalog of the requested locale. */
export const generateMetadata = async ({ params }: HomePageProps): Promise<Metadata> => {
    const { locale } = await params
    const t = await getTranslations({ locale, namespace: "home" })
    return { title: t("title") }
}

/** The first page of the app; a server component, so no catalog is shipped for it. */
const HomePage = async ({ params }: HomePageProps) => {
    const { locale } = await params
    setRequestLocale(locale)
    const t = await getTranslations("home")
    return (
        <main>
            <h1>{t("title")}</h1>
        </main>
    )
}

export default HomePage
