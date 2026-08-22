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
| `@receipt-schema` | `orchestration/receipt.schema.json` | file | định nghĩa compact orchestration receipt mà mỗi bound skill emit |
| `@validate-orchestration` | `scripts/validate-orchestration.mjs` | script | từ chối ownership không an toàn hoặc skill binding thiếu |

## Bản ghi

Module này là một nơi duy nhất của luật điều phối agent không phụ thuộc provider. Skill được chọn vẫn sở hữu luật
business, design, source và proof; orchestration chỉ chia việc mà không đổi decision, approval hay write boundary.
Runtime adapter dịch cùng một bộ role sang capability Claude Code hoặc Codex.

## Vai trò

**Coordinator** là owner duy nhất của decision và integration. Nó resolve scope, business và journey meaning,
chọn UI direction, phân loại state ownership, trình approval, đóng băng exact boundary, review worker receipt,
integrate shared file và tuyên bố verdict cuối.

**Worker** nhận một task bounded với một output owner. Worker có thể inventory evidence, sinh cache HTML,
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

Layout, Block và Refactor hiển thị một row `orchestration` không cần approval sau khi bind scope/evidence và trước
khi render direction. Coordinator công bố orchestration receipt gọn gồm:

1. runtime adapter và model role đã resolve;
2. task id, dependency và loại `read`, `cache-write`, `source-write` hay `proof`;
3. exact output và writer path của từng task;
4. decision và shared path chỉ coordinator được giữ;
5. concurrency batch và sequential fallback.

Receipt nằm trong user-facing step plan, nhưng raw prompt, hidden context và tool chatter vẫn internal. Nó không
thêm owner approval và không tách staged approval sẵn có.

## Dispatch contract

Mỗi worker task bind `taskId`, skill và step đã chọn, immutable context-envelope id, objective, required input,
allowed read, exact write, forbidden decision, required proof và stop condition. Mỗi result trả `taskId`, status,
input hash, observation có provenance, changed path, command/proof, unresolved finding và boundary-drift flag.

Coordinator từ chối receipt khi envelope stale, evidence chưa chứng minh, write ngoài boundary, worker đã tự đưa
decision hoặc task khác sở hữu cùng path. Work bị từ chối không được integrate ngầm.

Receipt được revalidate và append-only refresh tại mỗi coordinator phase gate. Cache task bind exact frozen
contract hash. Source task bind `OK #2:<source-boundary-hash>`, complete approved path set và, khi Refactor evolve
authority, compiled authority-proof hash. Proof task bind stable-build/proof-target hash và phụ thuộc mọi source
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
- Nhiều agent không đồng nghĩa tiến độ. Dùng tập worker nhỏ nhất giúp rút ngắn phần việc độc lập; việc tuần tự vẫn tuần tự.
- Dirty hoặc target overlap không thể quy nguồn dừng assignment và trả về coordinator.

## Runtime và fallback

Đo active host trước khi dispatch và chọn đúng một adapter. Không trộn Claude và Codex agent trong cùng một
orchestration receipt. Nếu delegation, model yêu cầu hoặc boundary tách rời an toàn không khả dụng, chạy tuần tự
cùng task dưới coordinator với context firewall và receipt không đổi. Fallback chỉ đổi scheduling, không đổi
authority hay proof.

## Phạm vi

Module này hiện bind `starci-fe-design-layout`, `starci-fe-design-block` và
`starci-fe-layout-refactor`. Skill khác vẫn tuần tự đến khi tự load authority này và publish phase map đã validate.
