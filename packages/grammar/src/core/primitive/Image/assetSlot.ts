/**
 * The asset-slot attributes of a piece of art owed to (or delivered by) the product's asset workflow
 * (`interface.asset`): the slot id, the sha256 of the delivered file and the prompt it was generated
 * from. They are emitted verbatim as `data-asset-slot`, `data-asset-sha256` and `data-asset-prompt` on the
 * component root, so a drawing, a test or an audit can tie the rendered art to its request. They never
 * change the paint.
 */
export type AssetSlotProps = {
    readonly assetSlot?: string
    readonly assetSha256?: string
    readonly assetPrompt?: string
}

/** The `data-asset-*` attributes for the slot props that are set. */
export const assetSlotAttributes = ({ assetSlot, assetSha256, assetPrompt }: AssetSlotProps) => ({
    ...(assetSlot === undefined ? {} : { "data-asset-slot": assetSlot }),
    ...(assetSha256 === undefined ? {} : { "data-asset-sha256": assetSha256 }),
    ...(assetPrompt === undefined ? {} : { "data-asset-prompt": assetPrompt }),
})
