# Lane E2E-05 — todo plan + notify + share flows

SCOPE (exclusive): `D:/Repositories/starci-academy-backend/.claude/D:/Repositories/starci-academy-backend/.claude/examples/todo-app-backend/test/e2e/{plan,notify,share}/`

Specs: `plan-journey.e2e-spec.ts` (upgrade → quota applies → downgrade → limits restored), `notify-preferences.e2e-spec.ts` (update prefs → event → unsubscribe → no notify), `share-journey.e2e-spec.ts` (invite → accept → collaborator sees/edits tasks → revoke → access gone). Longest journeys — split each flow into its own spec file.
