# lite-app production on Swarm

The API and Next web app run on a Docker Swarm VPS behind Caddy. Supabase supplies
PostgreSQL, Auth, Storage and Queues; this stack runs the app's compute. Only ingress
publishes ports. The API consumes the least-privilege database URL and the privileged
Supabase integration key through mounted Swarm secrets and the existing `_FILE` reader.
The dev environment remains managed Supabase metadata with local app processes.

This is a value-free release fixture, not a deployed service. Its image digests are
illustrative: build and publish the API image from `be/apps/api/Dockerfile` and the
web image from `fe/apps/web/Dockerfile` with the app root as their build context, and
replace all three digests with verified registry digests in both the stack and the
declaration before deployment. The web image must include its static output and be
built with `--build-arg` for `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GRAPHQL_URL`, `NEXT_PUBLIC_REST_URL`,
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the production
project. These browser configuration values are public; a service-role key never
enters the web image.

Before the first release, initialize the VPS as a Swarm manager, point the site's
DNS to it, provide registry access, and apply the forward-only Supabase migrations.
Export the nonsecret `SITE_HOST` (DNS name), `SITE_ORIGIN` (HTTPS origin) and
`SUPABASE_URL` values in the release shell. The commands below run from
`.starcistacks/production/infra/swarm` and assume the stack name `lite-app`.

| command | what it does |
| --- | --- |
| prepare | `docker stack config -c stack.yaml` renders the release configuration; save this value-free model in the OS temp directory for release verification and run `starci gate starcistacks <app-root>` before deployment. Verify the published digests and create the versioned external secrets first. |
| doctor | `docker info --format '{{.Swarm.LocalNodeState}}'` must answer `active`; `docker secret inspect lite-app-database-url-v1 lite-app-supabase-service-role-key-v1` confirms the release's external secret names exist. |
| up | `docker stack deploy --with-registry-auth -c stack.yaml lite-app` deploys the declared compute; Swarm rolls out one task at a time and rolls back failed updates. |
| status | `docker stack services lite-app` and `docker stack ps lite-app --no-trunc` show task placement and rollout failures. |
| logs | `docker service logs --follow lite-app_api` follows the API; use `lite-app_web` or `lite-app_ingress` for the other components. |
| down | `docker stack rm lite-app` removes compute. External secrets, Supabase data and the manager's Caddy volumes remain available to the next release. |
| verification | `curl --fail "https://$SITE_HOST/health/live"` checks the routed API, then open `https://$SITE_HOST` and verify a booking reaches `confirmed` through the app's pgmq worker. |
| rollback | `docker service rollback lite-app_api` restores that service's previous image and secret bindings; repeat for another service only when its release requires rollback. |

The fixture's `secrets: []` means it holds no real custody. For an operated release,
seal each secret as a SOPS dotenv envelope under `production/secrets/<slug>.enc`
with the shared master age recipient and record its plaintext member, recipient
policy and key custody in `environments.production.secrets`. `docs/host-secrets.md`
owns the shared host identity. Materialize through that custody only for the release,
then send the selected variable's exact bytes to `docker secret create
lite-app-database-url-v1 -` or `docker secret create
lite-app-supabase-service-role-key-v1 -`. Do not commit the materialized file.
Swarm secrets are immutable: a rotation creates `-v2`, updates the stack references
and redeploys; retain `-v1` until its rollback window has closed. A Caddyfile change
likewise increments the config's `lite-app-ingress-v1` name before deployment.

Recurring work is app-owned. This example's queue relay and workers run in the API
and use Supabase Queues (pgmq); pg_cron ticks or a backend scheduler can enqueue
recurring work. There is no scheduled CLI batch in this fixture. If one is added,
declare a scheduler component and a `mode: replicated-job` component with its cron
schedule, zero replicas, `restart_policy.condition: none` and Swarm cronjob labels,
or convert it to an app scheduler. Do not install a host crontab.
