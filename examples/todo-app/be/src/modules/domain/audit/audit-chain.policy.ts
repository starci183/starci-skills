import { createHash } from "node:crypto"

/** The previous-hash marker of the first line of the chain. */
export const GENESIS_HASH = "GENESIS"

/** The fields a line hash covers. */
export interface ChainLine {
    /** The hash of the previous line. */
    readonly prevHash: string
    /** When the action happened. */
    readonly at: Date
    /** The action label. */
    readonly action: string
    /** What it touched. */
    readonly target: string | null
    /** The id of the sealing key. */
    readonly keyId: string
    /** The sealed actor. */
    readonly actor: string
}

/** The hash of one line: SHA-256 over the previous hash and every field the line holds. */
export const hashLine = (line: ChainLine): string =>
    createHash("sha256")
        .update(
            `${line.prevHash}|${line.at.toISOString()}|${line.action}|${line.target ?? ""}|${line.keyId}|${line.actor}`,
        )
        .digest("hex")
