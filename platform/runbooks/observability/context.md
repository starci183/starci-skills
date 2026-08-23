# Observability: cAdvisor, Prometheus and Grafana Cloud

## LOADS

None.

## Use when

Use this page to expose live container metrics locally or send the same Prometheus series to Grafana
Cloud. The repository currently scrapes cAdvisor every 15 seconds and remote-writes to the configured
Grafana Cloud Metrics instance.

## Before

```powershell
docker info
npm run secret:gen -- dev
npm run sync
```

Confirm the remote-write URL and metrics instance ID in Grafana Cloud Portal → stack → Prometheus/Details.
The committed URL and username in `prometheus.yml` must match that stack before a token is installed.

## Secrets

Create a Grafana Cloud access-policy token scoped to `metrics:write` (add `logs:write` only when the same
token is intentionally shared with Loki). Store it at:

```powershell
npm run secret:set -- dev/runtime/files/grafana-cloud-write-token.key
npm run sync
```

Encrypted owner: `.stacks/dev/runtime/files/grafana-cloud-write-token.key.enc`. Prometheus mounts the
decrypted twin read-only as `/run/secrets/grafana-cloud-write-token`.

## Run

```powershell
npm run compose
npm run compose -- logs -f cadvisor prometheus
```

Do not change the steady-state `starci-` container prefix: the application health service selects and
normalizes cAdvisor series by that prefix.

## Verify

```powershell
Invoke-WebRequest http://localhost:8082/metrics
Invoke-RestMethod http://localhost:9091/-/ready
Invoke-RestMethod "http://localhost:9091/api/v1/targets"
Invoke-RestMethod "http://localhost:9091/api/v1/query?query=up"
```

Prometheus target `cadvisor:8080` must be `UP`. In Grafana Cloud Explore, select the hosted Prometheus
datasource and query `up` or a `container_*` metric; series should carry `project=starci-academy` and
`environment=development` external labels.

## Stop or rollback

`npm run compose -- down` stops local collection and preserves Prometheus data. To stop only external
egress, remove/disable the `remote_write` block in a reviewed change or revoke the Grafana token; do not
delete local metrics volumes as a first response.

## Rotate

Issue a new access-policy token, replace the fixed encrypted record, run `sync`, recreate Prometheus,
verify fresh samples in Grafana Cloud, then revoke the old token.

## Troubleshoot

| Symptom | First check |
|---|---|
| no local targets | `cadvisor` running and target exactly `cadvisor:8080` |
| remote write 401/403 | metrics instance ID, endpoint region and token `metrics:write` scope |
| token file missing in container | run `npm run sync`, then recreate Prometheus |
| health page has no component metrics | container names retain `starci-` prefix |
| high Grafana Cloud usage | inspect active series and increase scrape interval only as a reviewed cost decision |

## Upstream

- [Grafana Cloud Prometheus remote write](https://grafana.com/docs/grafana-cloud/send-data/metrics/metrics-prometheus/prometheus-config-examples/integration-guide/)
- [Prometheus configuration](https://prometheus.io/docs/prometheus/latest/configuration/configuration/)
- [cAdvisor](https://github.com/google/cadvisor)
