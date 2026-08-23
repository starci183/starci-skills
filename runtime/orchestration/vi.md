---
title: Điều phối agent
---

# Điều phối agent

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@codex-orchestration` | `runtime/orchestration/codex/vi.md` | vi | map contract chung sang coordinator Sol và worker Luna |
| `@claude-orchestration` | `runtime/orchestration/claude/vi.md` | vi | map contract chung sang coordinator Opus và worker Sonnet |
| `@phase-maps` | `runtime/orchestration/maps/vi.md` | vi | route physical skill đã chọn tới đúng một phase map đã validate |
| `@profiles` | `runtime/orchestration/profiles.json` | file | giữ role model và concurrency ở dạng machine-readable |
| `@receipt-schema` | `runtime/orchestration/receipt.schema.json` | file | định nghĩa internal run record được machine validate |
| `@validate-orchestration` | `scripts/validate-orchestration.mjs` | script | từ chối ownership không an toàn hoặc skill binding thiếu |

## Bản ghi

Module này là một nơi duy nhất của luật điều phối agent không phụ thuộc provider cho mọi physical StarCi skill.
Skill được chọn vẫn sở hữu luật business, design, source và proof; orchestration chỉ chia việc mà không đổi
decision, approval hay write boundary. Runtime adapter dịch cùng một bộ role sang capability Claude Code hoặc
Codex, còn `profiles.skillMaps` bind mọi skill với exact pipeline, impact và approval shape.

## Vai trò

**Coordinator** là integration owner, không phải nguồn chân lý không thể bị phản biện. Nó resolve scope và
authority, sở hữu domain decision, trình approval, đóng băng exact boundary, review worker receipt, integrate
shared target và tuyên bố verdict cuối.

**Worker** nhận một task bounded với một output owner. Worker có thể inventory và challenge evidence, materialize
artifact đã freeze, implement repository change đã duyệt trong file tách rời, chạy test hoặc capture proof.
Worker không chọn scope/authority, consume approval, nở scope, sửa shared authority, làm provider mutation,
integrate thay đổi chồng lấn hay tuyên bố hoàn tất.

## Ownership theo phase

| Phase | Decision owner | Việc có thể giao worker | Join gate |
|---|---|---|---|
| scope và evidence | coordinator | inventory độc lập route, source, component, contract và state | mọi receipt có provenance và cùng immutable envelope |
| authority và decision | coordinator | counterevidence read-only và feasibility check | coordinator accept một decision hoặc discrepancy receipt |
| bounded materialization | coordinator sở hữu meaning và acceptance | sinh cache artifact hoặc frozen output khác | output khớp accepted input và không thêm decision |
| write boundary | coordinator | audit owner-chain, target và impact cone | một exact writer registry và approval boundary |
| execution | coordinator sở hữu authority/external mutation và integration | approved repository change cùng test trên target tách rời | một writer mỗi target; mọi obligation đã duyệt được map |
| proof | coordinator sở hữu final verdict | gate, remote read, capture và mismatch inventory | coordinator tái hiện evidence và chỉ đóng khi zero known mismatch |

Materialization và approved repository work rời nhau có thể giao worker. Scope, authority, product/UI decision,
ownership classification, provider mutation và acceptance thuộc coordinator. Worker có thể đề xuất fact hoặc
counterexample; không được biến chúng thành decision đã chọn.

## Bước orchestration bắt buộc

Mọi selected skill resolve entry `profiles.skillMaps` và phase-map record sau khi bind scope/evidence, trước
delegable task đầu tiên. Layout, Block và Refactor giữ row `orchestration` non-approval rõ ràng; skill khác dùng
nguyên step `PIPELINE` hiện hữu mà không thêm ceremony cho user. Coordinator lập compact orchestration receipt gồm:

1. runtime adapter và model role đã resolve;
2. task id, dependency và loại `read`, `cache-write`, `repository-write`, `authority-write`, `external-write` hay `proof`;
3. exact output và writer target của từng task;
4. decision và shared path chỉ coordinator được giữ;
5. concurrency batch và sequential fallback.

Record không nằm trong user-facing step plan. Chỉ hiện material progress, evidence, decision và exact boundary.
Mỗi output phải có downstream task, gate hoặc delivery result tiêu thụ; artifact không dùng làm complete run invalid.

## Dispatch contract

Mỗi worker task bind `taskId`, skill và step đã chọn, immutable context-envelope id, objective, required input,
allowed read, exact write, forbidden decision, required proof và stop condition. Mỗi result trả `taskId`, status,
input hash, observation có provenance, changed path, command/proof, unresolved finding và boundary-drift flag.

Coordinator từ chối receipt khi envelope stale, evidence chưa chứng minh, write ngoài boundary, worker đã tự đưa
decision hoặc task khác sở hữu cùng path. Work bị từ chối không được integrate ngầm.

Với impact `capability` và `cross-domain`, reviewer thứ hai nhận evidence nhưng không thấy recommendation của
coordinator, không được write state, có quyền raise challenge cụ thể và phải close chúng bằng evidence trước mutation dispatch.

Receipt được revalidate và append-only refresh tại mỗi coordinator phase gate. Cache task bind cả exact frozen
contract hash lẫn validated target-matched `qualityReviewAt` hash, và phụ thuộc event `contract-freeze` cùng
`quality-review` đã pass. Mọi mutation bind complete approved target set và exact approval label của selected skill
từ `profiles.skillMaps`; frontend staged write giữ `OK #1`/`OK #2`, còn capability boundary thường dùng `OK`.
Mọi map khai cả `manual` và `auto`; exact `mode=auto` bind cùng identity vào immutable envelope, còn map không-write
đi tiếp mà không invent approval. Authority/external write là sequential task chỉ coordinator làm. Khi Refactor evolve authority, repository task phụ thuộc còn bind compiled
authority-proof hash. Proof task bind stable-state/proof-target hash và phụ thuộc mọi mutation task. Future task
không được dispatch khi gate identity còn thiếu.

Mỗi phase gate đồng thời là coordinator event đã pass. Worker task gọi event id trong `dependsOnGates`; chỉ copy
hash mà không có event không thể unlock work. `impactConeAt` được tính lại từ owner, consumer, test, required
target và inventory proof đã disclose; mỗi required target nhận đúng một writer.

## Luật dependency và writer

- Chỉ parallel task khi required input đã pass gate và output/write ownership không chồng lấn.
- Một target có một writer cho cả batch. Directory boundary chưa đủ nếu hai task có thể chạm cùng file.
- Authority `.claude`, approval record, shared contract, shared entrypoint, manifest và final integration chỉ thuộc coordinator.
- Worker chỉ được implement repository state sau write-authorizing approval của selected skill và trong subset được giao.
- Authority và external/provider mutation vẫn coordinator-only dù evidence/proof read được delegate.
- Worker không spawn worker. Chỉ coordinator refill slot, follow up, interrupt và close task.
- Nhiều agent không đồng nghĩa tiến độ. Ba worker là runtime capacity hiện tại, không phải optimum. Chỉ dispatch
  ready/disjoint work khi thời gian dự kiến tiết kiệm lớn hơn coordination overhead; còn lại chạy tuần tự.
- Dirty hoặc target overlap không thể quy nguồn dừng assignment và trả về coordinator.

## Runtime và fallback

Đo active host trước khi dispatch và chọn đúng một adapter. Không trộn Claude và Codex agent trong cùng một
orchestration receipt. Nếu delegation, model yêu cầu hoặc boundary tách rời an toàn không khả dụng, chạy tuần tự
cùng task dưới coordinator với context firewall và receipt không đổi. Fallback chỉ đổi scheduling, không đổi
authority hay proof.

Khi hoàn tất, record phải đo wall time, token usage nếu đo được, coordinator rework, approval đã đổi decision,
unique defect bắt được, false-positive gate và artifact creation/use. `scripts/summarize-run-metrics.mjs` chỉ so
các impact level tương đương. Luật không có outcome evidence dương phải bị hạ thành optional hoặc loại bỏ.

## Phạm vi

Module này bind mọi physical StarCi capability qua `profiles.skillMaps`. Validator từ chối entry thiếu, dư hoặc
stale và mọi topology/step order khác `PIPELINE` của selected skill. Coverage không ép delegation: map chạy
sequential khi không có worker task an toàn, ready, disjoint và overhead-positive.
