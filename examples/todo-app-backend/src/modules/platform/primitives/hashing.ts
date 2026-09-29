import {
    createHash
} from "node:crypto"

/** The lowercase hex SHA-256 digest of a UTF-8 string; the one hashing primitive the capabilities share. */
export const sha256Hex = (text: string): string => createHash("sha256").update(text).digest("hex")
