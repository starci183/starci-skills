// node-image.mjs - the one owner of the node major of the throwaway Linux containers: the release parity step (scripts/supervisor/release-linux-parity.mjs)
// runs in it when no workflow names one, and the install sandbox (scripts/gates/install-sandbox.mjs --docker) always does.

/** The node major of the Linux container image `node:<major>`. */
export const DEFAULT_NODE = '22';
