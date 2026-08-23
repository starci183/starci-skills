---
title: Observability
---

# Observability: cAdvisor, Prometheus và Grafana Cloud

## Dùng khi

Dùng trang này để expose live container metrics ở local hoặc gửi cùng Prometheus series lên Grafana
Cloud. Repository hiện scrape cAdvisor mỗi 15 giây và remote-write sang Grafana Cloud Metrics instance
được cấu hình.

## Trước khi chạy

```powershell
docker info
npm run secret:gen -- dev
npm run sync
```

Xác nhận remote-write URL và metrics instance ID tại Grafana Cloud Portal → stack → Prometheus/Details.
URL/username đã commit trong `prometheus.yml` phải khớp stack đó trước khi cài token.

## Secrets

Tạo Grafana Cloud access-policy token có scope `metrics:write` (chỉ thêm `logs:write` khi chủ đích dùng
cùng token cho Loki). Lưu tại:

```powershell
npm run secret:set -- dev/runtime/files/grafana-cloud-write-token.key
npm run sync
```

Encrypted owner: `.stacks/dev/runtime/files/grafana-cloud-write-token.key.enc`. Prometheus mount decrypted
twin read-only thành `/run/secrets/grafana-cloud-write-token`.

## Chạy

```powershell
npm run compose
npm run compose -- logs -f cadvisor prometheus
```

Không đổi steady-state prefix container `starci-`: application health service chọn và normalize cAdvisor
series dựa trên prefix này.

## Verify

```powershell
Invoke-WebRequest http://localhost:8082/metrics
Invoke-RestMethod http://localhost:9091/-/ready
Invoke-RestMethod "http://localhost:9091/api/v1/targets"
Invoke-RestMethod "http://localhost:9091/api/v1/query?query=up"
```

Prometheus target `cadvisor:8080` phải `UP`. Trong Grafana Cloud Explore, chọn hosted Prometheus datasource
và query `up` hoặc metric `container_*`; series phải có external label `project=starci-academy` và
`environment=development`.

## Dừng hoặc rollback

`npm run compose -- down` dừng local collection và giữ Prometheus data. Muốn dừng external egress, remove/
disable `remote_write` bằng reviewed change hoặc revoke Grafana token; không xóa local metrics volume như
phản ứng đầu tiên.

## Rotate

Issue access-policy token mới, replace fixed encrypted record, chạy `sync`, recreate Prometheus, verify
sample mới trong Grafana Cloud, rồi revoke token cũ.

## Troubleshoot

| Triệu chứng | Kiểm tra đầu tiên |
|---|---|
| không có local target | `cadvisor` running và target đúng `cadvisor:8080` |
| remote write 401/403 | metrics instance ID, endpoint region và scope token `metrics:write` |
| token file thiếu trong container | chạy `npm run sync`, rồi recreate Prometheus |
| health page không có component metrics | tên container giữ prefix `starci-` |
| Grafana Cloud usage cao | xem active series; chỉ tăng scrape interval như một reviewed cost decision |

## Upstream

- [Grafana Cloud Prometheus remote write](https://grafana.com/docs/grafana-cloud/send-data/metrics/metrics-prometheus/prometheus-config-examples/integration-guide/)
- [Prometheus configuration](https://prometheus.io/docs/prometheus/latest/configuration/configuration/)
- [cAdvisor](https://github.com/google/cadvisor)
