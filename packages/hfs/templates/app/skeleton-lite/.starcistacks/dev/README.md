# Development stack

The app services may run in a local Docker Swarm; local Supabase is started separately with its CLI and supplies the database and broker. The tracked model contains no self-hosted database.
The application image references contain illustrative all-zero digests. Replace them with verified published release digests and prepare external secrets before starting the container model. Replace its starter `SUPABASE_URL` with the local Supabase endpoint reachable from the Swarm node, and seal that local database connection and integration credential; a container cannot use the host's loopback address without owner-configured networking. Local source development remains available through the app scripts.

| Command | Operation |
| --- | --- |
| prepare | Run `npm run db:start` at the app root; obtain the local Supabase connection and Auth configuration. An owner who chooses local Swarm initializes it, labels its node `{{project}}=dev` and provisions the ingress volumes. Create the external development secrets named in the model from real sealed members. |
| doctor | From this directory, run `docker stack config -c infra/swarm/stack.yaml`. Confirm image, secret and local Supabase availability. |
| up | Run `docker stack deploy -c infra/swarm/stack.yaml {{project}}-dev` from this directory after preparation. |
| status | Run `docker stack services {{project}}-dev`. |
| logs | Run `docker service logs {{project}}-dev_api`; never print mounted credentials. |
| down | Run `docker stack rm {{project}}-dev`. |
| verification | Confirm the API `/health/live` and `/health/ready` endpoints, then run `npm run lint` from the app root. |

Keep real sealed members under `.starcistacks/dev/secrets/*.enc`, add them to the manifest after sealing and inventory their key names in the environment record. The scaffold creates no fake secret or successful proof.
