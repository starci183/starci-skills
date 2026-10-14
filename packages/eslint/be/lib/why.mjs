/**
 * The catalogue sub-codes the back-end laws publish: `{ <rule id>: { code } }`.
 * A rule's own code comes from its enforcer row in knowledge/hfs/rules.yaml; a SECOND code a rule emits
 * (one rule, several failure codes) is named here so scripts/checks/check-hfs-rules.mjs sees it as emitted.
 * Append-only: each alpha.15 batch adds its own secondary codes at the end (union-merged).
 */
export const why = {
  "webhook-inbox-key": { code: "BE_WEBHOOK_INBOX_KEY" },
  "rest-route-declared": { code: "BE_REST_ROUTE_UNDECLARED" },
  "security-headers": { code: "BE_SECURITY_HEADERS" },
  "trust-proxy": { code: "BE_TRUST_PROXY" },
  "health-signals": { code: "BE_HEALTH_SIGNALS" },
}
