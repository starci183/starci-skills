import { Button, Heading, PageContainer, SectionHeader, SurfaceCard, Text } from "@starci/grammar/common"
import { CatalogueTile, DuckMascot } from "@ecommerce/ui"
import { landingPageClassNames } from "./classNames"

/** One pillar of the "why Northwind" strip, with its sentence already resolved. */
export type LandingPillar = {
    readonly title: string
    readonly copy: string
}

/** One teaser product with its copy and price already resolved. */
export type LandingTeaserProduct = {
    readonly id: string
    readonly name: string
    readonly blurb: string
    /** The price formatted in the reader's language. */
    readonly price: string
}

/** The landing page's resolved inputs: every string and link arrived already settled. */
export type LandingPageProps = {
    /** The data payload for whatever state is showing. */
    readonly props: {
        readonly heroTitle: string
        readonly heroLede: string
        readonly startShopping: string
        readonly seePicks: string
        readonly catalogueTitle: string
        readonly catalogueDescription: string
        readonly viewFull: string
        readonly pillarsTitle: string
        readonly pillars: ReadonlyArray<LandingPillar>
        readonly teaser: ReadonlyArray<LandingTeaserProduct>
        /** The shop origin with the locale already joined, for the cross-app hand-off links. */
        readonly shopHref: string
    }
}

/**
 * The whole public storefront, drawn from resolved props: a welcome hero (the mascot's
 * `mayAppearIn` welcome surface), the curated teaser grid, and the "why Northwind" pillars.
 * Everything below the header is composition - each region maps to a grammar primitive or stays
 * an app-owned layout, per the anatomy contract.
 */
export const LandingPageBase = (props: LandingPageProps) => (
    <PageContainer measure="product" className={landingPageClassNames.page}>
        <div className={landingPageClassNames.hero}>
            <DuckMascot size={96} aria-hidden />
            <Heading level={1} scale="display">
                {props.props.heroTitle}
            </Heading>
            <div className={landingPageClassNames.heroCopy}>
                <Text size="md" tone="muted">
                    {props.props.heroLede}
                </Text>
            </div>
            <div className={landingPageClassNames.heroActions}>
                <Button href={props.props.shopHref} variant="primary" size="lg">
                    {props.props.startShopping}
                </Button>
                <Button href="#catalogue" variant="secondary" size="lg">
                    {props.props.seePicks}
                </Button>
            </div>
        </div>

        <div id="catalogue" role="region" className={landingPageClassNames.section} aria-labelledby="catalogue-heading">
            <SectionHeader
                id="catalogue-heading"
                title={props.props.catalogueTitle}
                description={props.props.catalogueDescription}
                action={
                    <Button href={props.props.shopHref} variant="outline" size="sm">
                        {props.props.viewFull}
                    </Button>
                }
                level={2}
            />
            <div className={landingPageClassNames.grid}>
                {props.props.teaser.map((product) => (
                    <CatalogueTile key={product.id} name={product.name} price={product.price} blurb={product.blurb} />
                ))}
            </div>
        </div>

        <div id="about" role="region" aria-labelledby="about-heading">
            <SectionHeader id="about-heading" title={props.props.pillarsTitle} level={2} />
            <div className={landingPageClassNames.grid}>
                {props.props.pillars.map((pillar) => (
                    <SurfaceCard key={pillar.title} label={pillar.title} height="fill">
                        <Text size="sm" tone="muted">
                            {pillar.copy}
                        </Text>
                    </SurfaceCard>
                ))}
            </div>
        </div>
    </PageContainer>
)
