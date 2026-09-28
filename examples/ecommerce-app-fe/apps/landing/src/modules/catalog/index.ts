/** A single sellable item. Kept deliberately small: the landing teaser only needs a name, a price and a blurb. */
export type Product = {
  readonly id: string;
  readonly name: string;
  readonly blurb: string;
  /** Minor currency units (cents) so prices never round through a float. */
  readonly priceCents: number;
  /** ISO 4217 code every amount on this page is billed in. */
  readonly currency: string;
};

/**
 * Editorial sample catalogue for the public teaser. The real catalogue is served by the `order` API that the
 * shop browses; the landing intentionally ships static copy so it renders without any backend running.
 */
export const CATALOG: ReadonlyArray<Product> = [
    {
        id: "aurelis-desk-lamp",
        name: "Aurelis Desk Lamp",
        blurb: "Warm, dimmable light with a weighted brass base.",
        priceCents: 8900,
        currency: "USD",
    },
    {
        id: "meridian-carry-tote",
        name: "Meridian Carry Tote",
        blurb: "Waxed canvas, laptop sleeve, carries a week of errands.",
        priceCents: 14500,
        currency: "USD",
    },
    {
        id: "northwind-pour-over",
        name: "Northwind Pour-Over Set",
        blurb: "Borosilicate carafe and a stainless steel filter that never needs paper.",
        priceCents: 6200,
        currency: "USD",
    },
    {
        id: "kestrel-field-jacket",
        name: "Kestrel Field Jacket",
        blurb: "Weatherproofed cotton with pockets that actually close.",
        priceCents: 23000,
        currency: "USD",
    },
    {
        id: "solstice-notebook",
        name: "Solstice Notebook",
        blurb: "Lay-flat binding, 120gsm pages, dot grid.",
        priceCents: 2400,
        currency: "USD",
    },
    {
        id: "harbor-speaker",
        name: "Harbor Field Speaker",
        blurb: "Two-day battery and a lanyard you can clip to a pack.",
        priceCents: 11800,
        currency: "USD",
    },
]

const CURRENCY_LOCALE: Readonly<Record<string, string>> = {
    USD: "en-US",
    EUR: "de-DE",
    VND: "vi-VN",
}

/** Format a minor-unit amount for display, falling back to a plain currency-tagged number for unknown codes. */
export const formatPrice = (priceCents: number, currency: string): string => {
    const locale = CURRENCY_LOCALE[currency] ?? "en-US"
    try {
        return new Intl.NumberFormat(locale, { style: "currency", currency }).format(priceCents / 100)
    } catch {
        return `${(priceCents / 100).toFixed(2)} ${currency}`
    }
}
