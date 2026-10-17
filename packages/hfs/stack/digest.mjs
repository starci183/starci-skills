// digest.mjs - image reference and release identifier guards (the all-zero placeholder digest is never a real image).
/** A registry image reference pinned by a real sha256 digest; the all-zero placeholder digest is refused. */
const DIGEST_REF = /^[a-z0-9./_-]+(?::[A-Za-z0-9._-]+)?@sha256:(?!0{64}$)[0-9a-f]{64}$/u;

/** A release identifier: the first 16 hex characters of the release digest. */
export const RELEASE_ID = /^[0-9a-f]{16}$/u;

/** Detects an unreplaced image digest in an image reference or in rendered stack bytes. */
export const hasPlaceholderDigest = (bytes) => /@sha256:0{64}(?![0-9a-f])/u.test(String(bytes));

/** True for a pinned image reference; `allowUnpinned` (a local throwaway swarm) still refuses the placeholder digest. */
export const isImageReference = (value, allowUnpinned = false) =>
  typeof value === 'string' && value.length > 0 && !hasPlaceholderDigest(value) && (allowUnpinned || DIGEST_REF.test(value));

/** True for 16 lowercase hex characters. */
export const isReleaseId = (value) => typeof value === 'string' && RELEASE_ID.test(value);
