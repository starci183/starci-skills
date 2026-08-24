# Execute UI Test

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@ui-testing` | `fe.ui-testing` | qdrant | run the approved journey through a real browser and test account |
| `@journey` | `fe.customer-journey` | qdrant | preserve page order, global progress ownership, and terminal outcome |
| `@layout` | `fe.layout-composition` | qdrant | verify approved composition and responsive transformation |
| `@state` | `fe.state-modeling` | qdrant | reach and prove required business-backed UI states |
| `@seed` | `fe.product-seeding` | qdrant | use reproducible test data without inventing state |
| `@source-fe` | `knowledge/references/starci-academy-fe.json` | file | inspect only established FE browser-harness precedent at the immutable commit |

## Steps

1. Run `validate-input.mjs`; stop before browser launch or credential resolution on failure.
2. Verify the FE workspace route, current manifest, app URL, source hash, seed hash, `@source-fe` commit, and Qdrant virtual root.
3. Open the running app in a real browser at its public entry route. Resolve the opaque test account through the approved credential provider without printing values.
4. Sign in through visible UI, then navigate and act through visible controls exactly as an ordinary user. Do not inject cookies/storage, call internal APIs, script DOM state, or jump to private routes to bypass the journey.
5. Execute every scenario at wide, intermediate, and compact viewports. Verify page order, global journey progress, text and controls, keyboard/focus path, accessible names, loading/error recovery, overflow, sticky fallback, final outcome, refresh persistence, and sign-out boundary.
6. Capture sanitized screenshots, trace, console/network failures, accessibility results, scenario counts, approved hashes, and test-account reference. Redact secrets before persistence.
7. Classify a failure as in-boundary repair, boundary drift, or blocked. Never change product source in this operator.
8. Run `validate-output.mjs`; invalid, partial, shortcut-based, or unsanitized proof is not emitted.
