# Production stack

The tracked model declares Docker Swarm application services and one digest-pinned Caddy ingress.
Supabase supplies PostgreSQL, Auth and pgmq. This stack runs no PostgreSQL, Redis or MongoDB service.
The model is a deployment declaration. It contains no owner credentials, real DNS receipt, completed release or restore proof. Public records under `.starcistacks/production/infra/swarm/` explicitly mark those owner-run operations as pending.
Its application image references contain illustrative all-zero digests; they identify no published image and must be replaced before deployment.

The runtime template tracks no encrypted members. Scaffolding generates the two declared members with placeholder values encrypted to this app's own recipient in `.sops.yaml`. Replace those values with `starci app secret set production` using the matching host age identity in untracked local custody. Existing generated envelopes are decryptable with that app identity and can be updated in place. Each Docker secret contains the corresponding key's real value, and the API receives it through its declared mounted file.

| Command | Operation |
| --- | --- |
| prepare | Owner provisions the Swarm, node label, database, DNS and real sealed secret members, then runs `starci app stack prepare --env production --execute` to create the missing external volumes (the one-time swarm initialization stays an owner-approved step: `--init-swarm` with `--execute`, after the owner's explicit approval). Release images are built and pushed by the managed the managed stack-deploy workflow. |
| doctor | Run `starci app stack doctor --env production` (read-only): docker, swarm, volumes, services, secrets, configs and the release pointers on the intended manager. |
| up | After preparation and review, run the manual stack-deploy workflow (Actions, deploy stack) on a release tag; it builds the images and runs `starci app stack deploy --env production --image <service>=<repository>@sha256:<digest> --source-sha <sha> --execute`. A dry run is `starci app stack render` or `deploy` without `--execute`. |
| status | Run `starci app stack doctor --env production`, or `starci app stack converge --env production --since <ISO time>` to inspect desired and running replicas plus update state. |
| logs | Run `docker service logs {{project}}-production_api` on the manager; never include secret values in a receipt. |
| down | After the owner's removal decision, run `docker stack rm {{project}}-production`; persistent external volumes remain in owner custody. |
| verification | Run `starci app stack verify --env production` (the journeys declared in `deploy.verify`); also confirm public TLS and a signed-in GraphQL request before moving the release pointer. |

## Owner actions before the first release

Every item is pending. Swarm initialization, provider URIs, DNS changes and key rotation are owner-run steps.

| Area | Required owner action and evidence |
| --- | --- |
| Swarm and placement | Initialize the intended manager; label the intended stateful node `{{project}}=production`. Only that node owns the external ingress volumes. |
| DNS | Replace the reserved `example.invalid` hosts consistently in the manifest, Caddyfile and public configuration; publish address records for the web and API hosts and retain a provider receipt in `.starcistacks/production/infra/swarm/owner-actions.md`. |
| TLS | Caddy issues certificates after real DNS resolves. Provision `{{project}}-production-ingress-data` and `{{project}}-production-ingress-config-data` on the selected node; retain an issuance and renewal receipt in `.starcistacks/production/infra/swarm/owner-actions.md`. |
| Database | Provision Supabase and the app_be connection; provider backups remain enabled. Record the provider URI and recovery owner without copying credentials here. |
| Secret custody | Replace generated placeholder values with real values at the manifest's declared `.starcistacks/production/secrets/*.enc` paths; record their keys in `.starcistacks/production/runtime/env/KEYS.md`. The app's age identity stays only in the host's untracked `.claude/secret.env`. |
| External secrets | Materialize the sealed members in owner custody and create `{{project}}-production-primary-db-url-v1` and `{{project}}-production-supabase-service-role-key-v1`. The API reads mounted files; rotation creates new versioned names before updating the model. |
| Public build configuration | Build the front end with its declared public site and GraphQL URLs, the Supabase public URL and anonymous key. Public browser values stay outside sealed secret custody. |
| Immutable release | Replace the illustrative all-zero application digests in the manifest, model and `.starcistacks/production/infra/swarm/releases/images.lock.yaml` with digests produced by the verified release. Store each rendered release under `/srv/{{project}}/releases/<digest>`. Retain the last accepted record in `.starcistacks/production/infra/swarm/releases/previous.yaml`, then move the current pointer and update `.starcistacks/production/infra/swarm/releases/current.yaml` after verification. |
| Rollback | Retain the previous model and images, redeploy that model if convergence or health fails, and record the resulting convergence receipt. Database changes follow an expand/contract sequence. |
| Backup | Provision the manifest's seven days of database PITR and thirty daily encrypted off-host database exports and ingress-volume snapshots. Record the actual destination and encryption custody in `.starcistacks/production/infra/swarm/recovery/restore-proof.md`; the production operator owns both components. |
| Restore proof | Perform a restore into isolated infrastructure, verify the restored database and ingress state, and attach a dated receipt with artifact digests to `.starcistacks/production/infra/swarm/recovery/restore-proof.md`. Its initial record is pending; no restore has been run by scaffolding. |

No host scheduler is installed. Scheduled application work belongs to the back-end scheduler or an explicitly declared replicated job.
