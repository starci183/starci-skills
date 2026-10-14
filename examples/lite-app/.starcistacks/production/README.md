# lite-app production

Single-manager Docker Swarm on one Ubuntu VPS; the Supabase Cloud project is the external datastore. This directory
is the environment's custody: `environment.json` describes it, `infra/swarm/stack.yaml` is the deployable stack,
`runtime/env/KEYS.md` is the environment key roster, and `secrets/*.enc` are the sealed secret members (sops, the
project age recipient in `../../.sops.yaml`).

## Owner actions (declared, never automated)

1. DNS at the registrar: A records for `lite-app.example` and `api.lite-app.example` → the VPS. Receipt: `nslookup`.
2. `docker swarm init` on the VPS once (the manager constraint in the stack file assumes it).
3. Keep the age identity backed up outside the repository; the VPS never holds it.
4. Create the Supabase Cloud project, run `supabase db push` for the migrations under `supabase/migrations/`, and set
   the `app_be` role password.

## Deploy

```sh
# Seal or reseal the api member (sops reads the recipient from .sops.yaml).
sops encrypt -i secrets/api.enc

# Create one external secret per key of the member (the deploy decrypts in memory only).
docker secret create lite-app-PRIMARY_DB_URL-v1 -
docker secret create lite-app-SUPABASE_SERVICE_ROLE_KEY-v1 -
docker secret create lite-app-CALENDAR_WEBHOOK_SECRET-v1 -

# Create the immutable routes config and deploy.
docker config create lite-app-routes-c1 infra/swarm/edge/routes.yml
LITE_APP_CFG_ROUTES=lite-app-routes-c1 \
LITE_APP_SECRET_PRIMARY_DB_URL=lite-app-PRIMARY_DB_URL-v1 \
LITE_APP_SECRET_SUPABASE_SERVICE_ROLE_KEY=lite-app-SUPABASE_SERVICE_ROLE_KEY-v1 \
LITE_APP_SECRET_CALENDAR_WEBHOOK_SECRET=lite-app-CALENDAR_WEBHOOK_SECRET-v1 \
ACME_EMAIL=ops@lite-app.example \
LITE_APP_API_IMAGE=registry.example/lite-app/api@sha256:<digest> \
LITE_APP_WEB_IMAGE=registry.example/lite-app/web@sha256:<digest> \
docker stack deploy --with-registry-auth -c infra/swarm/stack.yaml lite-app
```

Rotation seals a new value, creates a new versioned secret name, updates the grant and removes the old name after
convergence.

## Health gates

The Swarm healthcheck of every service is liveness only: process-local, dependency-free (`/health/live`), so a
Supabase outage never restarts the api. Readiness (`/health/ready`: the primary database and the job ledger answer)
gates traffic at the ingress in `edge/routes.yml`; a not-ready task leaves the load balancer and is never killed for
it.
