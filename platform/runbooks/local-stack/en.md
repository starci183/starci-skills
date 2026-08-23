---
title: Local stack
---

# Local stack

## Use when

Use this page to prepare, start, inspect, stop or reset the complete StarCi development infrastructure.
The wrapper owns all ten backing services and their resolved host ports.

## Before

Docker Desktop must be running and the repository-owned secrets must exist:

```powershell
docker info
npm ci
npm run secret:gen -- dev
npm run sync
```

`metadata.json` is the only host-port authority. Do not paste literal ports into Compose fragments.

## Secrets

`secret:gen` supplies PostgreSQL, Redis, Elasticsearch, Qdrant, MinIO, NATS, Keycloak and CSRF values.
Kafka, cAdvisor and Prometheus have no local authentication. Grafana Cloud remote write is optional for
local boot and is covered by the Observability runbook.

## Run

Start and wait for health/readiness:

```powershell
npm run compose
```

Inspect or follow logs:

```powershell
npm run compose -- ps
npm run compose -- logs -f
npm run compose -- logs -f postgres
```

Start the API after infrastructure is healthy:

```powershell
npm run start:dev
```

## Verify

Resolved development endpoints from `metadata.json`:

| Service | Purpose | Verify |
|---|---|---|
| PostgreSQL `5433` | primary datasource | `npm run compose -- exec postgres pg_isready` |
| Redis `6380` | cache, queues, throttler, sockets | container is healthy in `compose -- ps` |
| Elasticsearch `9201` | search projections | `Invoke-RestMethod http://localhost:9201` must authenticate or answer cluster data with credentials |
| Qdrant `6334` / gRPC `6335` | vector search | `Invoke-RestMethod http://localhost:6334/healthz` |
| Kafka `9093` | CDC event stream | container remains running; inspect Kafka logs for listener errors |
| MinIO `9001`, console `9002` | development S3 | `Invoke-WebRequest http://localhost:9001/minio/health/live` |
| NATS `4223`, monitor `8223` | JetStream job events | `Invoke-RestMethod http://localhost:8223/varz` |
| Keycloak `8081` | identity provider | `Invoke-WebRequest http://localhost:8081/realms/master` |
| cAdvisor `8082` | container metrics | `Invoke-WebRequest http://localhost:8082/metrics` |
| Prometheus `9091` | scrape/query metrics | `Invoke-RestMethod http://localhost:9091/-/ready` |

Then verify the application surface at its configured health/GraphQL endpoint and check that no service
is `unhealthy` or restarting:

```powershell
npm run compose -- ps
```

## Stop or rollback

Normal stop preserves data:

```powershell
npm run compose -- down
```

The following wipes every local datastore volume and is only for an intentional reset:

```powershell
npm run compose -- down -v
```

Before `down -v`, confirm that PostgreSQL data, Keycloak realm state, MinIO objects, indexes, vectors and
queues are disposable or backed up.

## Rotate

Redis, Qdrant and NATS may rotate with a coordinated file update, `sync` and container restart. PostgreSQL,
Elasticsearch and Keycloak bootstrap credentials are stored inside initialized volumes; rotate through
their native admin surface or reset the corresponding disposable volume together with the record.

## Troubleshoot

| Symptom | First check |
|---|---|
| published port is blank/wrong | use `npm run compose`; never direct `docker compose` |
| `REPLACE_ME` or missing credential refusal | `npm run secret:gen -- dev`, then `npm run sync` |
| MinIO init is exited | exit code `0` is success; inspect `minio-init` logs |
| Kafka connects once then hangs | advertised host port must come from `STARCI_PORT_KAFKA` |
| Keycloak admin password changed but login fails | bootstrap value and existing volume disagree |
| Elasticsearch auth fails after rotation | bootstrap password and existing volume disagree |
| public health page has no metrics | check cAdvisor, Prometheus and the `starci-` container prefix |

## Upstream

- [Docker Compose](https://docs.docker.com/compose/)
- Each image and version is pinned in `.stacks/dev/infra/compose/*.yaml`.
