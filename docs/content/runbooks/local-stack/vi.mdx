---
title: Local stack
---

# Local stack

## Dùng khi

Dùng trang này để prepare, start, inspect, stop hoặc reset toàn bộ hạ tầng development StarCi. Wrapper
sở hữu cả mười backing service và host port đã resolve của chúng.

## Trước khi chạy

Docker Desktop phải chạy và repository-owned secrets phải tồn tại:

```powershell
docker info
npm ci
npm run secret:gen -- dev
npm run sync
```

`metadata.json` là authority duy nhất cho host port. Không paste port literal vào Compose fragment.

## Secrets

`secret:gen` cấp value cho PostgreSQL, Redis, Elasticsearch, Qdrant, MinIO, NATS, Keycloak và CSRF.
Kafka, cAdvisor và Prometheus không có local authentication. Grafana Cloud remote write là optional cho
local boot và nằm trong runbook Observability.

## Chạy

Start và đợi health/readiness:

```powershell
npm run compose
```

Inspect hoặc follow log:

```powershell
npm run compose -- ps
npm run compose -- logs -f
npm run compose -- logs -f postgres
```

Start API sau khi infrastructure healthy:

```powershell
npm run start:dev
```

## Verify

Development endpoint resolve từ `metadata.json`:

| Service | Mục đích | Verify |
|---|---|---|
| PostgreSQL `5433` | primary datasource | `npm run compose -- exec postgres pg_isready` |
| Redis `6380` | cache, queues, throttler, sockets | container healthy trong `compose -- ps` |
| Elasticsearch `9201` | search projections | `Invoke-RestMethod http://localhost:9201` phải yêu cầu auth hoặc trả cluster data khi có credential |
| Qdrant `6334` / gRPC `6335` | vector search | `Invoke-RestMethod http://localhost:6334/healthz` |
| Kafka `9093` | CDC event stream | container tiếp tục running; xem Kafka logs nếu lỗi listener |
| MinIO `9001`, console `9002` | development S3 | `Invoke-WebRequest http://localhost:9001/minio/health/live` |
| NATS `4223`, monitor `8223` | JetStream job events | `Invoke-RestMethod http://localhost:8223/varz` |
| Keycloak `8081` | identity provider | `Invoke-WebRequest http://localhost:8081/realms/master` |
| cAdvisor `8082` | container metrics | `Invoke-WebRequest http://localhost:8082/metrics` |
| Prometheus `9091` | scrape/query metrics | `Invoke-RestMethod http://localhost:9091/-/ready` |

Sau đó verify application surface tại health/GraphQL endpoint được cấu hình và bảo đảm không service
nào `unhealthy` hoặc restart liên tục:

```powershell
npm run compose -- ps
```

## Dừng hoặc rollback

Stop thường giữ data:

```powershell
npm run compose -- down
```

Lệnh sau xóa mọi local datastore volume và chỉ dùng khi chủ đích reset:

```powershell
npm run compose -- down -v
```

Trước `down -v`, xác nhận PostgreSQL data, Keycloak realm state, MinIO objects, indexes, vectors và queues
có thể bỏ hoặc đã backup.

## Rotate

Redis, Qdrant và NATS có thể rotate bằng coordinated file update, `sync` và container restart. PostgreSQL,
Elasticsearch và Keycloak bootstrap credential nằm trong volume đã initialize; rotate qua native admin
surface hoặc reset đúng disposable volume cùng record.

## Troubleshoot

| Triệu chứng | Kiểm tra đầu tiên |
|---|---|
| published port trống/sai | dùng `npm run compose`; không gọi trực tiếp `docker compose` |
| `REPLACE_ME` hoặc refusal thiếu credential | `npm run secret:gen -- dev`, rồi `npm run sync` |
| MinIO init đã exited | exit code `0` là thành công; xem log `minio-init` |
| Kafka connect lần đầu rồi treo | advertised host port phải đến từ `STARCI_PORT_KAFKA` |
| đổi Keycloak admin password nhưng login lỗi | bootstrap value và volume hiện tại không khớp |
| Elasticsearch auth lỗi sau rotate | bootstrap password và volume hiện tại không khớp |
| public health page không có metrics | kiểm tra cAdvisor, Prometheus và prefix container `starci-` |

## Upstream

- [Docker Compose](https://docs.docker.com/compose/)
- Mỗi image/version được pin trong `.stacks/dev/infra/compose/*.yaml`.
