import type { Secret } from "@modules/platform/config"

/** Options of the order capability. */
export interface OrderOptions {
    /** The key the cursors of the order list are signed with; every replica of the api shares it, so a cursor one replica made is valid on another. */
    readonly pageCursorKey: Secret
}
