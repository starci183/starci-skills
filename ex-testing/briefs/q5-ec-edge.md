# Lane Q5 (qwen) — ec unit edge-fill

SCOPE (exclusive): `examples/ecommerce-app-be/src/modules/**`, `examples/ecommerce-app-be/src/features/**` (NOT src/tests).

Edge cases: payment failure/refund paths, cart concurrent ops, catalog stock boundaries, session expiry/revoke, cross-service client errors (identity client timeout, order client 5xx), config validation. TestingModule.
