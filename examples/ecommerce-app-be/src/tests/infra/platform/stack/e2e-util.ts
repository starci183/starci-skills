/**
 * Compat re-export: the generic stack utilities moved to the shared @e2e-kit package
 * (@e2e-kit/platform/*). Consumers still importing from this path keep resolving; each
 * consumer migrates to the deep kit paths on its own lane.
 */
export {
    freePorts 
} from "@e2e-kit/platform/free-ports"
export {
    retryUntil, sleep 
} from "@e2e-kit/platform/readiness"
export type {
    ReadinessResult 
} from "@e2e-kit/platform/readiness"
export {
    runToken, secret, specHash 
} from "@e2e-kit/platform/run-tokens"
