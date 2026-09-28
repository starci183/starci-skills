/**
 * The catalogue tile's media: the served image, and the tinted initial-letter stand-in a row with
 * no image URL renders instead.
 */
export const catalogueTileClassNames = {
    image: "h-full w-full object-cover",
    fallback: "brand-primary-tint grid aspect-[4/3] place-items-center rounded-xl text-4xl font-semibold",
} as const
