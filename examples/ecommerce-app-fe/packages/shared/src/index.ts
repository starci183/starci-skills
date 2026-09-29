/** The package's public entry: the client-safe surface. Server-only readers stay on their own subpath exports. */
export { SlotView, type SlotViewProps } from "./components/composites/SlotView"
export { CatalogueTile, type CatalogueTileProps } from "./components/leaves/CatalogueTile"
export { DuckMascot, type DuckMascotProps } from "./components/leaves/DuckMascot"
export { StateBlock, type StateBlockProps } from "./components/leaves/StateBlock"
export { collectionSlot, type Slot } from "./modules/slot"
