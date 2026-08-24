# UI testing as a real user

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.ui-testing` |
| Operators | `test/ui` |
| Search tags | `browser test, test account, real user, customer journey, accessibility, responsive, screenshot, trace` |
| Dependencies | `fe.customer-journey, fe.layout-composition, fe.state-modeling, fe.product-seeding` |

## Record

UI proof opens the running application in a real browser and follows the selected customer journey with a declared test account as an ordinary user. Direct database mutation, internal route shortcuts, DOM scripting that bypasses controls, and authenticated storage injection are not user interaction and cannot prove the journey.

Start from the public entry route. Sign in through the visible authentication surface unless a declared reusable authenticated setup is itself part of the product test contract. Navigate, type, select, submit, recover, sign out, and revisit through user-visible controls. Never expose secret values in logs, screenshots, traces, or output artifacts.

For each page and required state, capture user-visible assertions plus wide, intermediate, and compact evidence. Check keyboard reachability, focus order, accessible names, loading and error recovery, overflow, sticky fallback, journey progress, and final persisted outcome. Evidence includes scenario result, sanitized trace, screenshots, console/network failures, and the exact source and seed hashes.

If the app cannot start, the account is absent or unsafe, authentication fails before the scenario, or a required state cannot be reached normally, return blocked. If code violates the approved direction inside its boundary, return an in-boundary repair. If correction changes layout, ownership, responsive transformation, or source boundary, return to the existing layout approval checkpoint.
