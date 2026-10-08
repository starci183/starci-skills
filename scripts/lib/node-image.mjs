// node-image.mjs - the one owner of the node major of the throwaway Linux containers: the release parity step (scripts/supervisor/release-linux-parity.mjs)
// runs in it when no workflow names one, and the install sandbox (scripts/gates/install-sandbox.mjs --docker) always does.

/** The node major of the Linux container image `node:<major>`. */
export const DEFAULT_NODE = '22';

/**
 * The Debian release of the release parity container's node image. GitHub's ubuntu-latest runner ships a current git; the image's default release (bookworm)
 * carries git 2.39, which lacks `git merge-tree --merge-base` (2.40) and `git rev-parse --show-ref-format` (2.46), so a gate that needs them behaves differently there.
 * trixie carries git 2.47.
 */
const PARITY_DISTRO = 'trixie';

/** The Linux container image of the release parity step for node major `major`. */
export const parityImage = (major) => `node:${major}-${PARITY_DISTRO}`;
