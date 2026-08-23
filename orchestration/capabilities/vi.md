---
title: Các map orchestration cho capability
---

# Các map orchestration cho capability

## LOADS

Không có.

## Record

Record này map mọi StarCi capability ngoài nhóm frontend-design vào coordinator/worker contract dùng chung. Bảng
`PIPELINE` của skill đã chọn vẫn giữ exact step order và authority. Map này chỉ quyết định work nào được isolate,
delegate và join; nó không thêm step, đổi approval hay biến skill read-only thành writer.

## Track ownership

| Pipeline track | Coordinator ownership | Delegable work | Join gate |
|---|---|---|---|
| `shared` | freeze envelope, route, authority và boundary | evidence inventory độc lập | mọi observation có provenance và cùng envelope |
| `top-down`, `bottom-up`, `declared`, `observed`, `reconciliation` | giữ origin tách biệt và accept/refuse receipt | bounded read và counterevidence | chỉ artifact đã accepted mới tới synthesis hoặc reconciliation |
| `join` | quyết định binding, discrepancy hoặc revision đã duyệt | challenge completeness nhưng không chọn decision | không còn obligation, target, branch hay proof bị unbound |
| `execution` | consume approval, reserve shared target và integrate | repository write rời nhau đã duyệt, test và bounded materialization | một writer mỗi target; authority/external mutation vẫn coordinator-only |
| `proof` | reproduce evidence và ra final verdict | check-only gate, remote read và proof capture | outcome đã khai giữ đúng, không còn unresolved finding |

`linear` giữ một authority có thứ tự. `dual-track` cần origin độc lập trước coordinator join. `reconciliation`
đo declared và observed state độc lập. Khi không có task boundary an toàn hoặc coordination overhead không dương,
cùng map chạy sequential dưới coordinator.

## Capability bindings

| Skill | Topology | Coordinator owns | Delegable work | Final gate |
|---|---|---|---|---|
| `starci-architecture-analyze` | dual-track, read-only | decision frame, tổng hợp phương án, recommendation và planning handoff | constraint evidence và current-capability evidence tách biệt | các phương án khả thi dùng cùng tiêu chí; recommendation qua phản biện và không source write |
| `starci-business-analyze` | reconciliation | evidence classification, lifecycle transition và publication | routed source evidence và contradiction inventory | feature head cùng implementation reconciliation validate |
| `starci-init` | reconciliation | bốn readiness boundary, quyết định portable declaration và publication ra ngoài | identity-safe check, route observation và portable schema proof | identity, bootstrap, portable/local route cùng durable worktree đều xanh; remote đã duyệt bằng đúng portable commit |
| `starci-cloudflare-tunnel-set` | reconciliation | credential authority và external apply | tunnel/DNS read inventory cùng proof read | tunnel và DNS state đã khai khớp |
| `starci-deploy` | reconciliation | release decision, external mutation và rollback | host/service observation cùng bounded proof | public steady state hoặc rollback đã chứng minh |
| `starci-setup-mcp` | reconciliation | read-only scope, credential authority và publication | route/index inventory cùng partition proof | mọi partition isolated và read-only |
| `starci-setup-sonar` | reconciliation | shared service/project mutation và strict gate decision | project inventory, scan và API proof | mọi role đã route có strict gate đo được |
| `starci-stale-list` | reconciliation, read-only | expected-state authority và report verdict | category observation độc lập cùng check-only gate | mọi finding reproducible; không có repair |
| `starci-diagnose` | reconciliation, read-only | simulated boundary và first-stop classification | expected và observed trace | tách environment failure khỏi skill defect |
| `starci-repair` | reconciliation | pass ordering, approval, shared file và close verdict | approved repository fix rời nhau cùng gate | complete stale và delivery inventory xanh |
| `starci-debt-repay` | reconciliation | debt scope, closure decision và record update | measurement độc lập, approved source fix và test | chỉ proven scope được close |
| `starci-fe-ui-reconcile` | reconciliation | cross-surface scope, discrepancy verdict, authority evolution và integration | declared/observed inventory độc lập, approved disjoint FE change và proof | durable authority cùng mọi approved consumer resolve nhất quán |
| `starci-grammar-refresh-references` | reconciliation | grammar boundary và authority-byte verdict | immutable reference audit cùng fetch evidence | reference resolve trong khi authority byte giữ nguyên |
| `starci-conversation-record` | linear | custody boundary, publication và stable head | provider metadata acquisition cùng redaction evidence | stored link validate, raw transcript không vào Git |
| `starci-be-plan` | dual-track | demand/capability join và complete brief | business-demand và schema/source inventory tách biệt | mọi behavior bind file và test; không source write |
| `starci-be-approve` | reconciliation | revision decision, approval và integration | schema/sibling challenge, approved code rời nhau và gate | implementation bằng revision đã duyệt |

## Approval execution mode

Mọi capability đã bind mặc định dùng `manual` và hỗ trợ exact `mode=auto`. Auto bind
`phaseGates.approvalMode: auto` cùng `autoApprovalAt` với immutable invocation envelope, chỉ đi tiếp sau khi cùng
step/proof gate pass và dùng label `OK` của selected map cho exact write boundary. Map không có write label đi qua
read-only hoặc no-write step mà không invent mutation approval. Credential, destructive loss, external
publication/commitment và mọi scope expansion chưa disclose vẫn dừng dưới `NEED APPROVALS`.

## Write kinds

- `repository-write` chỉ được delegate sau exact approval của skill đã chọn và chỉ trên các target rời nhau.
- `authority-write` và `external-write` vẫn coordinator-only nên dùng sequential runtime task.
- `cache-write` là materialization tạm từ frozen contract; `proof` consume stable state và frozen target.
- Capability read-only không emit mutation task. Worker trả evidence; coordinator viết final report.

## Stops

- Physical skill thiếu trong `profiles.skillMaps`, topology hoặc step order khác `PIPELINE`, hay map record bị thiếu.
- Worker sẽ quyết định scope, authority, approval, shared integration hoặc final verdict.
- Authority hay provider mutation bị giao cho worker runtime.
- Write target overlap writer khác, thiếu exact approval hoặc ra ngoài impact cone.

## Output

Một orchestration receipt đã validate hoặc sequential equivalent, bind selected skill, exact pipeline step,
immutable envelope, target registry, approval, result và final proof.
