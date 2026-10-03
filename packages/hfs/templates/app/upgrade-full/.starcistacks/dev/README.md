# Development stack

The full-edition development stack keeps PostgreSQL and the API in one declared Docker Compose project.

- Prepare: provide `PRIMARY_DB_URL` to the API through the normal secret custody flow.
- Up: `docker compose -f infra/compose/compose.yaml up -d`.
- Status: `docker compose -f infra/compose/compose.yaml ps`.
- Logs: `docker compose -f infra/compose/compose.yaml logs`.
- Down: `docker compose -f infra/compose/compose.yaml down`.
- Verify: call the API health endpoint and run `npm run lint`.
