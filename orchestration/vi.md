---
title: Điều phối agent
---

# Điều phối agent

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@codex-orchestration` | `orchestration/codex/vi.md` | vi | map contract chung sang coordinator Sol và worker Luna |
| `@claude-orchestration` | `orchestration/claude/vi.md` | vi | map contract chung sang coordinator Opus và worker Sonnet |
| `@frontend-map` | `orchestration/frontend/vi.md` | vi | bind từng step Layout, Block và Refactor vào đúng việc coordinator/worker |
| `@profiles` | `orchestration/profiles.json` | file | giữ role model và concurrency ở dạng machine-readable |
| `@receipt-schema` | `orchestration/receipt.schema.json` | file | định nghĩa internal run record được machine validate |
| `@validate-orchestration` | `scripts/validate-orchestration.mjs` | script | từ chối ownership không an toàn hoặc skill binding thiếu |

## Bản ghi

Module này là một nơi duy nhất của luật điều phối agent không phụ thuộc provider. Skill được chọn vẫn sở hữu luật
business, design, source và proof; orchestration chỉ chia việc mà không đổi decision, approval hay write boundary.
Runtime adapter dịch cùng một bộ role sang capability Claude Code hoặc Codex.

## Vai trò

**Coordinator** là integration owner, không phải nguồn chân lý không thể bị phản biện. Nó resolve scope, business và journey meaning,
chọn UI direction, phân loại state ownership, trình approval, đóng băng exact boundary, review worker receipt,
integrate shared file và tuyên bố verdict cuối.

**Worker** nhận một task bounded với một output owner. Worker có thể inventory và challenge evidence, sinh cache HTML,
implement source đã duyệt trong file tách rời, seed local data đã duyệt, chạy test hoặc capture browser proof.
Worker không chọn product/UI decision, consume approval, nở scope, sửa shared authority, integrate thay đổi chồng
lấn hay tuyên bố hoàn tất.

## Ownership theo phase

| Phase | Decision owner | Việc có thể giao worker | Join gate |
|---|---|---|---|
| scope và evidence | coordinator | inventory độc lập route, source, component, contract và state | mọi receipt có provenance và cùng immutable envelope |
| journey và UI direction | coordinator | counterevidence read-only và feasibility check | coordinator in và recommend direction |
| cache review | coordinator sở hữu anatomy và acceptance | sinh HTML/CSS/fixture và capture từ direction đã freeze | render khớp direction receipt và không thêm decision |
| state và source boundary | coordinator | audit state inventory, source-owner chain và impact cone | một exact writer registry và approval boundary |
| implementation | coordinator sở hữu integration | code, seed và test trong approved path tách rời | một writer mỗi path; mọi obligation đã duyệt được map |
| proof | coordinator sở hữu parity verdict | gate, browser operation, capture và mismatch inventory | coordinator tái hiện evidence và chỉ đóng khi zero known mismatch |

Sinh HTML và code là execution nên mặc định giao worker. Chọn journey, UI design, ownership classification và
acceptance là decision nên thuộc coordinator. Worker có thể đề xuất fact hoặc counterexample; không được biến chúng
thành design đã chọn.

## Bước orchestration bắt buộc

Layout, Block và Refactor lập kế hoạch orchestration nội bộ sau khi bind scope/evidence và trước khi render direction. Record gồm:

1. runtime adapter và model role đã resolve;
2. task id, dependency và loại `read`, `cache-write`, `source-write` hay `proof`;
3. exact output và writer path của từng task;
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
coordinator, không được write source, có quyền raise challenge cụ thể và phải close chúng bằng evidence trước source dispatch.

Receipt được revalidate và append-only refresh tại mỗi coordinator phase gate. Cache task bind cả exact frozen
contract hash lẫn validated target-matched `qualityReviewAt` hash, và phụ thuộc event `contract-freeze` cùng
`quality-review` đã pass. Source task bind complete approved path set cùng proportional approval identity:
component dùng `OK #1:<source-boundary-hash>`, page/full dùng `OK #2:<source-boundary-hash>`. Auto prefix cùng
identity bằng `AUTO:<autoApprovalAt>:` và bind
`autoApprovalAt` với immutable envelope. Cả hai dạng phụ thuộc cùng passed source-approval gate và exact writer
registry; không dạng nào authorize scope expansion hay external action. Khi Refactor evolve authority, source task
còn bind compiled authority-proof hash. Proof task bind stable-build/proof-target hash và phụ thuộc mọi source
task. Future task không được dispatch khi gate identity của nó còn thiếu.

Mỗi phase gate đồng thời là coordinator event đã pass. Worker task gọi event id trong `dependsOnGates`; chỉ copy
hash mà không có event không thể unlock work. `impactConeAt` được tính lại từ owner path, consumer, test, required
path và inventory proof đã disclose; mỗi required path nhận đúng một source writer.

## Luật dependency và writer

- Chỉ parallel task khi required input đã pass gate và output/write ownership không chồng lấn.
- Một path có một writer cho cả batch. Directory boundary chưa đủ nếu hai task có thể chạm cùng file.
- Authority `.claude`, approval record, shared contract, shared entrypoint, manifest và final integration chỉ thuộc coordinator.
- Worker chỉ được implement product source sau source-authorizing approval và chỉ trong subset được giao.
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

Module này hiện bind `starci-fe-design-layout`, `starci-fe-design-block` và
`starci-fe-layout-refactor`. Skill khác vẫn tuần tự đến khi tự load authority này và publish phase map đã validate.
