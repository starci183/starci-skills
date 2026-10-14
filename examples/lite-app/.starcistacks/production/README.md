# lite-app production

Single-manager Docker Swarm on one Ubuntu VPS; the Supabase Cloud project is the external datastore. This directory
is the environment's custody: `environment.json` describes it, `.starcistacks/production/infra/swarm/stack.yaml` is the deployable stack,
`runtime/env/KEYS.md` is the environment key roster, and `secrets/*.enc` are the sealed secret members (sops, the
project age recipient in `../../.sops.yaml`).

## Owner actions (declared, never automated)

1. DNS at the registrar: A records for `lite-app.example` and `api.lite-app.example` → the VPS. Receipt: `nslookup`.
2. `docker swarm init` on the VPS once (the manager constraint in the stack file assumes it).
3. Keep the age identity backed up outside the repository; the VPS never holds it.
4. Create the Supabase Cloud project, run `supabase db push` for the migrations under `supabase/migrations/`, and set
   the `app_be` role password.
5. Label the stateful manager `lite-app=production`, create the external `lite-app-production-acme` and
   `lite-app-production-n8n-data` volumes, and record their off-host encrypted backup destination and retention.
6. Build and publish the API and web release images by digest; the web build receives the public keys from the
   environment roster. Replace the reserved example hosts and Supabase URL with owner-provisioned endpoints.

## Deploy

```sh
cd .starcistacks/production

# Seal or reseal the api member (sops reads the recipient from .sops.yaml).
sops encrypt -i secrets/api.enc

# Create one external secret per key of the member (the deploy decrypts in memory only).
docker secret create lite-app-PRIMARY_DB_URL-v1 -
docker secret create lite-app-SUPABASE_SERVICE_ROLE_KEY-v1 -
docker secret create lite-app-CALENDAR_WEBHOOK_SECRET-v1 -

# Create the immutable routes config and deploy.
docker config create lite-app-routes-c1 infra/swarm/edge/routes.yml
# Export the public operator contact and verified image digests from the deployment roster.
docker stack deploy --with-registry-auth -c infra/swarm/stack.yaml lite-app
```

Rotation seals a new value, creates a new versioned secret name, updates the grant and removes the old name after
convergence.

## Health gates

The Swarm healthcheck of every service is liveness only: process-local, dependency-free (`/health/live`), so a
Supabase outage never restarts the api. Readiness (`/health/ready`: the primary database and the job ledger answer)
gates traffic at the ingress in `.starcistacks/production/infra/swarm/edge/routes.yml`; a not-ready task leaves the load balancer and is never killed for
it.

## Release and recovery

| Command      | Operation                                                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| prepare      | Complete the owner actions, provision external secrets and configs, and export the public deployment inputs.                                           |
| doctor       | From this directory, run `docker stack config -c infra/swarm/stack.yaml` and confirm the external secrets, config and volumes on the labelled manager. |
| up           | Run the deploy command above after reviewing the rendered model and release digests.                                                                   |
| status       | Run `docker stack services lite-app` and retain the convergence result.                                                                                |
| logs         | Run `docker service logs lite-app_api`; receipts contain no secret values.                                                                             |
| down         | On the owner's removal decision, run `docker stack rm lite-app`; external volumes remain in custody.                                                   |
| verification | Confirm TLS, both health probes, a signed-in GraphQL request, and the worker's queued-job completion.                                                  |

Store each verified rendered model and image roster under `/srv/lite-app/releases/<digest>`. Promote the current
pointer after verification and retain the previous release for rollback. Database changes follow an expand/contract
sequence. Supabase provider backups cover the external database; the owner backs up the ACME and n8n volumes with
encryption to an off-host target. Record the retention policy and complete a restore into isolated infrastructure
before first production use. DNS, TLS, backup destination and restore receipts are pending owner evidence; this
example does not claim a completed deployment or restore.
