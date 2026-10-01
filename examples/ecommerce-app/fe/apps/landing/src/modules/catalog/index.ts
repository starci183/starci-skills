/** A single teaser item: its identity and its price. The name and the blurb are catalogue copy under `landing.catalogue.products.<id>`. */
type TeaserProduct = {
    readonly id: string
    /** Minor currency units (cents) so prices never round through a float. */
    readonly priceCents: number
    /** ISO 4217 code every amount on this page is billed in. */
    readonly currency: string
}

/**
 * Editorial sample catalogue for the public teaser, in display order. The real catalogue is served by the
 * `order` API that the shop browses; the landing intentionally ships static data so it renders without any
 * backend running.
 */
export const CATALOG = [
    { id: "aurelisDeskLamp", priceCents: 8900, currency: "USD" },
    { id: "meridianCarryTote", priceCents: 14500, currency: "USD" },
    { id: "northwindPourOver", priceCents: 6200, currency: "USD" },
    { id: "kestrelFieldJacket", priceCents: 23000, currency: "USD" },
    { id: "solsticeNotebook", priceCents: 2400, currency: "USD" },
    { id: "harborSpeaker", priceCents: 11800, currency: "USD" },
] as const satisfies ReadonlyArray<TeaserProduct>
