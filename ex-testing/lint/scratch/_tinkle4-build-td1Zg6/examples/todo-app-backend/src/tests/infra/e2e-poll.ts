/**
 * Compat re-export: the state-poller moved to the shared @e2e-kit package
 * (@e2e-kit/platform/poll). Specs still importing from @tests/infra/e2e-poll keep resolving;
 * the e2e spec lane owns repointing them at the kit path.
 */
export {
    holdFor, pollUntil 
} from "@e2e-kit/platform/poll"
