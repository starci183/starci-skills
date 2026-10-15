# lite-app production

Single-manager Docker Swarm on one Ubuntu VPS; the Supabase Cloud project is the external datastore.
`environment.json` describes it, `infra/swarm/stack.yaml` is the declared stack, `infra/swarm/Caddyfile`
routes both public hosts, and `runtime/env/KEYS.md` lists the app's environment keys. Caddy is the one
declared ingress and the only component publishing ports, using Swarm ingress mode on 80 and 443.

Application image digests are illustrative all-zero placeholders and identify no published release.
The public runtime tracks member names without any `secrets/*.enc` files. Runtime CI, example render
checks and specs generate sealed placeholders with an ephemeral age identity in a disposable copy
under `os.tmpdir()` and remove it afterwards (the runtime example materializer and sealed-member writer). These placeholders supply no deployment credential.
A product seals its actual members to its own recipient and keeps the age identity only in the
owner's untracked local custody.

Public release and recovery records under `infra/swarm/release/` and `infra/swarm/recovery/` explicitly state pending owner evidence.
Neither those records nor the tracked stack claim a completed deployment, accepted release or restore.

## Owner actions (declared, never automated)

1. Replace reserved example hosts and Supabase endpoints with the product's endpoints. At the registrar,
   point A records for both hosts at the VPS; retain provider receipts and DNS verification.
2. Run `docker swarm init` on the VPS once and label the stateful manager `lite-app=production`.
3. Keep the age identity backed up outside the repository; the VPS never holds it.
4. Create the Supabase Cloud project, push the tracked migrations and set the least-privilege `app_be`
   role password. The CLI and API use the same declared primary connection.
5. Create external `lite-app-production-caddy-data`, `lite-app-production-caddy-config` and
   `lite-app-production-n8n-data` volumes on the labelled manager. Caddy persists certificate custody in
   its data volume; n8n persists its SQLite database in its own volume.
6. Build and publish the API and web images by digest. Update the declaration, stack and
   `infra/swarm/release/images.lock.yaml` with verified digests. Web public configuration is supplied
   at build time. Preserve Caddy and n8n's declared digest pins.
7. Record DNS and Caddy TLS issuance/persistence receipts in the declaration. Complete the encrypted
   off-host backup and isolated restore verification for Supabase, Caddy and n8n before production use.

## Deploy

From the product repository root, create the declared sealed members using the secret command.
Supply each value through stdin; never materialize or track plaintext files.
First run `npx starci app secret init` to configure `.sops.yaml` with that product's public recipient
and keep its matching identity in host custody. The runtime example supplies no existing envelope
to remove. Update members with the same product identity during later rotation.

```sh
npx starci app secret set production primary-db-url PRIMARY_DB_URL
npx starci app secret set production supabase-service-role-key SUPABASE_SERVICE_ROLE_KEY
npx starci app secret set production calendar-webhook-secret CALENDAR_WEBHOOK_SECRET

cd .starcistacks/production

# Pipe each decrypted value in memory into the matching immutable external secret.
docker secret create lite-app-primary-db-url-v1 -
docker secret create lite-app-supabase-service-role-key-v1 -
docker secret create lite-app-calendar-webhook-secret-v1 -

# Review the model after replacing illustrative application digests and provisioning volumes.
docker stack config -c infra/swarm/stack.yaml
docker stack deploy --with-registry-auth -c infra/swarm/stack.yaml lite-app
```

Rotation seals a new value, creates a new immutable secret version, updates `runtimeName`, `version`
and the rendered secret name together, and removes the old engine secret after convergence.

## Health gates and scheduled work

API and web Swarm healthchecks probe process-local `/health/live`; a Supabase outage does not kill
the API. Caddy probes API `/health/ready` and removes a not-ready upstream from traffic without
restarting its task. Its own healthcheck checks the local Caddy configuration endpoint.

The manifest job `booking_reminder_tick` matches the migration-owned pg_cron cadence `*/15 * * * *`.
Each tick only enqueues the booking-reminder message; the `send-reminder` job owns the catch-up scan.
The same work can be dispatched once from the product root with its declared app CLI command:

```sh
npm run cli -- booking-reminder tick
```

The command uses the existing app-owned queue door and least-privilege primary connection; it starts
no recurring scheduler. Do not install a host scheduler.

## Release and recovery

Retain the reviewed model, images lock and health receipts under `/srv/lite-app/releases/<digest>`.
After successful TLS, API readiness/liveness, web liveness, signed-in GraphQL and queued-job completion,
record the immutable release in `infra/swarm/release/current.yaml`. Retain the previous accepted
release in `.starcistacks/production/infra/swarm/release/previous.yaml` before promotion so it remains available for rollback. The initial pointers
truthfully contain no accepted release. Database changes follow an expand/contract sequence.

The declaration assigns each stateful component and managed backing exactly one backup policy:
Supabase provider backups plus encrypted exports, both Caddy volumes, and n8n's SQLite volume are
retained daily for 30 days in operator-owned off-host custody. Before first production use, restore
each into isolated infrastructure and replace `infra/swarm/recovery/<component>.yaml` with a
timestamp, backup hash, isolated destination and verification receipt. The example records are pending
plans, never receipts for an executed restore.

For convergence run `docker stack services lite-app`; for logs run `docker service logs lite-app_api`
and retain only public receipts. Remove the stack only on the owner's removal decision with
`docker stack rm lite-app`; external volumes and recovery custody remain.

| Command | Operation |
| --- | --- |
| prepare | Complete the owner actions, seal the declared secret members and replace illustrative image digests, then provision external secrets and volumes. |
| doctor | Run `docker stack config -c infra/swarm/stack.yaml` and confirm the declared secrets, config and volumes on the labelled manager. |
| up | Run the deploy command after reviewing the rendered model and verified image roster. |
| status | Run `docker stack services lite-app` and retain the convergence result. |
| logs | Run `docker service logs lite-app_api`; retain public receipts without secret values. |
| down | On the owner's removal decision, run `docker stack rm lite-app`; external volumes remain in custody. |
| verification | Confirm both health probes, TLS, signed-in GraphQL and queued-job completion before promotion. |
