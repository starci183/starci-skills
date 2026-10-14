# Production stack

The tracked model declares Docker Swarm application services and one digest-pinned Caddy ingress.
The production database is external PostgreSQL; the owner supplies its least-privilege connection through sealed custody.
The model is a deployment declaration. It contains no owner credentials, real DNS receipt, completed release or restore proof.

| Command | Operation |
| --- | --- |
| prepare | Owner provisions the Swarm, node label, persistent volumes, database, DNS and real sealed secret members; then build and publish immutable release images. |
| doctor | From this directory, run `docker stack config -c infra/swarm/stack.yaml` and confirm every external secret, config and volume exists on the intended manager. |
| up | After preparation and review, run `docker stack deploy -c infra/swarm/stack.yaml {{project}}-production` from this directory. |
| status | Run `docker stack services {{project}}-production` and inspect desired and running replicas plus update state. |
| logs | Run `docker service logs {{project}}-production_core` on the manager; never include secret values in a receipt. |
| down | After the owner's removal decision, run `docker stack rm {{project}}-production`; persistent external volumes remain in owner custody. |
| verification | Confirm public TLS, `/health/live`, `/health/ready`, the web `/health/live` endpoint and a signed-in GraphQL request before moving the release pointer. |

## Owner actions before the first release

Every item is pending. Swarm initialization, provider URIs, DNS changes and key rotation are owner-run steps.

| Area | Required owner action and evidence |
| --- | --- |
| Swarm and placement | Initialize the intended manager; label the intended stateful node `{{project}}=production`. Only that node owns the external ingress volumes. |
| DNS | Replace the reserved `example.invalid` hosts in the Caddyfile and model with owned names; publish address records for the product, API and landing hosts and retain a provider receipt. |
| TLS | Caddy issues certificates after real DNS resolves. Provision `{{project}}-production-ingress-data` and `{{project}}-production-ingress-config-data` on the selected node; retain an issuance and renewal receipt. |
| Database | Provision external PostgreSQL and its least-privilege application role. Record the provider URI and recovery owner without copying credentials here. |
| Secret custody | Seal real values only into `.starcistacks/production/secrets/*.enc`; record their keys in the environment inventory and add the real sealed members to the manifest. The age identity stays only in the host's untracked `.claude/secret.env`. |
| External secrets | Materialize the sealed members in owner custody and create `{{project}}-production-primary-db-url-v1`. The API reads mounted files; rotation creates new versioned names before updating the model. |
| Public build configuration | Build the front end with its declared public site and GraphQL URLs. Public browser values stay outside sealed secret custody. |
| Immutable release | Replace starter `:v0.0.0` image slots with the digests produced by the verified release. Store each rendered release under `/srv/{{project}}/releases/<digest>`; move the current pointer after verification and retain the previous release for rollback. |
| Rollback | Retain the previous model and images, redeploy that model if convergence or health fails, and record the resulting convergence receipt. Database changes follow an expand/contract sequence. |
| Backup | Back up the external database and ingress volumes to an owner-provisioned off-host destination; record retention, recovery owner, encryption and restore procedure. |
| Restore proof | Perform a restore into isolated infrastructure, verify the restored database and ingress state, and attach a dated receipt with artifact digests. No restore has been run by scaffolding. |

No host scheduler is installed. Scheduled application work belongs to the back-end scheduler or an explicitly declared replicated job.
