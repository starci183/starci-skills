/**
 * The brand mascot: a friendly duck (work/brand rev 1, `mascot.kind: duck`, `character: friendly`).
 *
 * Placement is the record's, not the component's: `mayAppearIn` is empty states, welcome surfaces
 * and the auth illustration; `neverIn` is danger contexts - so callers mount this mark on welcome
 * and empty surfaces only, and error/refusal renders never receive it. This is the ONE authored
 * mark, shared by the landing and the shop from the shared package; the direction a generated
 * successor is drawn from lives at `brand/duck.prompt.txt`, and until one exists the inline SVG
 * is the shipped mark - real artwork, not a fabricated remote image URL.
 *
 * The props mirror grammar's `IconSource` contract so the mark can mount in `EmptyNotice`'s
 * `iconSource`/`Icon` slots without an adapter.
 */
export type DuckMascotProps = {
  /** Edge length in pixels; the mark ships at 64 unless a surface asks for larger. */
  readonly size?: number;
  readonly focusable?: "false";
  readonly role?: "img";
  readonly "aria-hidden"?: boolean;
  readonly "aria-label"?: string;
  readonly "data-tier"?: string;
  readonly "data-component"?: string;
  readonly "data-usage"?: string;
};

/**
 * The drawn mark itself: one inline SVG, sized by `size` and otherwise passing the glyph contract's
 * attributes straight onto the root element.
 */
export const DuckMascot = (props: DuckMascotProps) => {
    const { size = 64, ...glyphProps } = props
    return (
        <svg viewBox="0 0 64 64" width={size} height={size} {...glyphProps}>
            {/* body and tail */}
            <path
                d="M14 44c-3-8 4-17 14-18l4-9c1-2 4-2 5 0l2 5c8 1 13 7 12 15-1 9-9 15-19 15S17 49 14 44Z"
                fill="#f7c948"
            />
            <path d="M14 44c-1-3-1-6 1-9l-7 3c-2 1-2 4 0 5l6 3Z" fill="#eeb63c" />
            {/* head */}
            <circle cx="44" cy="18" r="10" fill="#f7c948" />
            {/* beak */}
            <path d="M53 16l9 3-9 4c-2 1-4-1-4-3s2-5 4-4Z" fill="#ed8936" />
            {/* eye */}
            <circle cx="47" cy="15" r="1.8" fill="#3b2f13" />
            {/* cheek */}
            <circle cx="49.5" cy="20.5" r="2.4" fill="#eeb63c" opacity="0.55" />
            {/* wing */}
            <path
                d="M24 38c6-5 15-5 20 0-5 6-14 7-20 0Z"
                fill="#eeb63c"
            />
        </svg>
    )
}
