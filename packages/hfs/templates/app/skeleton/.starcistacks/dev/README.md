# Development stack

The development Docker Compose model contains the core API, the product and landing front ends, and a pinned local PostgreSQL database. Trust authentication is confined to this local, unpublished database.
Starter release images and external secrets must be prepared before starting the container model. Local source development remains available through the app scripts.

| Command | Operation |
| --- | --- |
| prepare | Build the app images and provide the local database connection through sealed custody. Materialize its real sealed member to the owner-controlled file `/run/starci-secrets/{{project}}/dev/primary-db-url`; Docker Compose mounts that file into the API. |
| doctor | From this directory, run `docker compose config -f infra/compose/stack.yaml`. Confirm image, secret and database availability. |
| up | Run `docker compose -f infra/compose/stack.yaml up -d` from this directory after preparation. |
| status | Run `docker compose -f infra/compose/stack.yaml ps`. |
| logs | Run `docker compose -f infra/compose/stack.yaml logs core`; never print mounted credentials. |
| down | Run `docker compose -f infra/compose/stack.yaml down`. |
| verification | Confirm the API `/health/live` and `/health/ready` endpoints, then run `npm run lint` from the app root. |

Keep real sealed members under `.starcistacks/dev/secrets/*.enc`, add them to the manifest after sealing and inventory their key names in the environment record. The scaffold creates no fake secret or successful proof.
