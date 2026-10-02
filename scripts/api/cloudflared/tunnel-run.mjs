// tunnel-run.mjs — `cloudflared tunnel ... run`: one Cloudflare tunnel process that connects a public hostname to a
// loopback origin. The connectors' tunnel manager (scripts/connectors/tunnel.mjs) supervises one per its plan (stdio piped,
// its output parsed); the harness UI's named tunnel (`starci harness start --tunnel`) runs one with stdio inherited.
import { cloudflaredStart } from './lib.mjs';

/**
 * The started ChildProcess of the tunnel `args` ({command, env, stdio}: see lib.mjs cloudflaredStart). A token the
 * caller must not leak is the caller's to drop from `env`.
 */
export const tunnelRun = (args, options = {}) => cloudflaredStart(args, options);
