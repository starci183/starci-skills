import { getLocale, getTranslations } from "next-intl/server"
import { CATALOG } from "../../../data/catalog"
import { SHOP_URL } from "../../../modules/config"
import { LandingPageBase } from "./component"

/** The teaser shows a curated slice of the catalogue rather than the whole order-service feed. */
const TEASER_COUNT = 3

/** Pillar order is layout, not copy: the titles and sentences live in the dictionary. */
const PILLAR_IDS = ["repairable", "onePrice", "carbonNeutral"] as const

/** Props for the connected landing page: the route mounts it empty and it reads its own world. */
export type LandingPageProps = Record<never, never>

/**
 * The connected landing page. Everything the screen says and links to is resolved here on the
 * server - the catalogue slice, the shop origin (a server-only read), and every sentence from the
 * shared dictionary - so the pure twin renders from a fixture with no dictionary, no request and
 * no provider. The locale joins the shop hand-off URL so the reader keeps their language across
 * the origin change.
 */
export const LandingPage = async (props: LandingPageProps) => {
    void props
    const t = await getTranslations("landing")
    const locale = await getLocale()
    return (
        <LandingPageBase
            state="ready"
            props={{
                heroTitle: t("hero.title"),
                heroLede: t("hero.lede"),
                startShopping: t("hero.startShopping"),
                seePicks: t("hero.seePicks"),
                catalogueTitle: t("catalogue.title"),
                catalogueDescription: t("catalogue.description"),
                viewFull: t("catalogue.viewFull"),
                pillarsTitle: t("pillars.title"),
                pillars: PILLAR_IDS.map((id) => ({
                    title: t(`pillars.${id}.title`),
                    copy: t(`pillars.${id}.copy`),
                })),
                teaser: CATALOG.slice(0, TEASER_COUNT),
                shopHref: `${SHOP_URL}/${locale}`,
            }}
            on={{}}
        />
    )
}
