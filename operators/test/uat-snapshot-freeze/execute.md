# Execute `test/uat-snapshot-freeze`

Freeze one canonical product-decision UAT snapshot under the routed backend authority.

Consume runtime and template authority; do not edit them. Never write checkout-local `.uat` or a project-nested worktree.
Write the exact `.worktrees/uat/<feature>/<flow>/snapshot.json`, validate its content against the
canonical snapshot schema, and return the parsed-content fingerprint. A path string without the
existing valid file is not a frozen snapshot.
