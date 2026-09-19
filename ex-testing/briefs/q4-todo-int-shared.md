# Lane Q4 (qwen) — todo integrations+shared unit edge-fill

SCOPE (exclusive): `examples/todo-app-backend/src/modules/integrations/**`, `src/modules/shared/**`.

Edge coverage: webhook signature failures, client timeout/retry, malformed payload handling; shared pipes/interceptors/guards negative paths. TestingModule, mock at provider boundary.
