---
title: starci-architecture-analyze · Tiếng Việt
description: Phân tích evidence-first, ưu tiên người đọc cho quyết định kỹ thuật cross-system khó.
---

# starci-architecture-analyze

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/vi.md` | vi | contract reporting và orchestration dùng chung |
| `@workspaces` | `contexts/workspaces/vi.md` | vi | resolve và verify mọi routed source được dùng làm evidence |
| `@business` | `contexts/business/vi.md` | vi | giữ phương án kỹ thuật bên trong product truth đã chấp nhận |

## NESTED SKILLS

Không có. Lượt phân tích trả decision context; nó không tự bắt đầu planning, approval hay implementation.

## PIPELINE

Topology: `dual-track` và read-only.

| Bước | Nhánh | Đầu vào | Cách thực hiện | Đầu ra bắt buộc | Điều kiện kiểm tra |
|---|---|---|---|---|---|
| constraints | top-down | mục tiêu owner, business head hiện tại và quan tâm phi chức năng | tách fixed intent, preference, constraint đo được, assumption và unknown | decision frame | không candidate nào âm thầm đổi product truth |
| capability | bottom-up | routed source đã verify, runtime topology, data ownership và test hiện hữu | lần current flow và tìm leverage, coupling cùng failure boundary thật | current-state model có evidence | mọi current-state claim cite live evidence |
| alternatives | join | decision frame cùng current-state model đã chấp nhận | dựng 2–4 solution thật sự khả thi và so hậu quả | option set và trade-off matrix | alternative khác nhau thực chất và dùng cùng tiêu chí |
| decision-handoff | proof | option set cộng adversarial challenge | recommend hoặc ghi một decision, giải thích phương án thua, vẽ một luồng đơn giản và khóa planning input | human analysis và planning context gọn | decision, invariant, risk, unknown và proof expectation đều rõ |

## Mục đích

Cho người đọc đủ evidence và phản biện để hiểu một quyết định kỹ thuật khó trước khi bất kỳ ai gọi tên file
implementation. Dùng cho data placement cross-service, consistency, recovery, security boundary, capacity,
bandwidth, latency, migration hoặc lựa chọn liên kết tương tự nơi một thay đổi hợp lý cục bộ có thể làm hỏng hệ
khác. Không dùng cho CRUD thường, operation đã có sibling rõ, local correction nhỏ hay request đã yêu cầu exact
file và test.

## Biên giới

Skill đọc project route đã verify, business authority hiện tại, source, test và runtime configuration đã khai.
Nó không viết product source, business authority, provider state hay implementation plan. Câu trả lời là bản phân
tích ưu tiên người đọc cộng context block gọn để planning owner được request riêng có thể dùng. Nó có thể đề xuất
một câu hỏi về product truth nhưng không được publish sự thật đó.

## Cách chạy

1. Đọc `@skill-shape`, `@workspaces` và `@business`. Resolve project, exact decision question, mọi routed role bị
   ảnh hưởng cùng business head hiện tại. Verify route head, branch, origin và instructions trước khi đọc target source.
2. Xác định bài toán có đáng phân tích sâu không. Chỉ tiếp tục khi có ít nhất hai design khả thi hoặc một trade-off
   cross-boundary đáng kể về failure/cost/security. Nếu không, giải thích direct answer và để file planning thường
   cho planning owner thay vì tạo alternative giả.
3. Dựng decision frame từ năm loại input riêng: fixed owner intent, business rule đã chấp nhận, constraint phi chức
   năng đo được, preference/default và unknown chưa giải. Không nâng preference thành requirement.
4. Lần hệ thống hiện tại từ live source. Theo ownership và data qua entry, persistence, processing, serving,
   deletion và recovery. Cite exact repository-relative path cùng line range cho fact chọn hoặc loại phương án.
   Screenshot và example có thể giải thích intent nhưng không chứng minh implementation.
5. Dựng từ hai đến bốn option khả thi khác nhau thực chất. Bao gồm current design nếu giữ nguyên vẫn hợp lý. Chấm
   mọi option theo cùng tiêu chí liên quan: correctness, data ownership, bandwidth/latency, capacity/cost,
   consistency, security/privacy, failure recovery, operability/observability, migration và testability. Bỏ tiêu chí
   thật sự không áp dụng thay vì lấp bảng bằng nhiễu.
6. Phản biện candidate mạnh nhất trước khi recommend. Thử partial failure, retry/idempotency, concurrency, stale
   state, deletion, recovery, dependency outage và rollback khi phù hợp. Định lượng limit đã biết; ghi rõ estimate
   và unknown thay vì bịa số.
7. Vẽ đúng một explanatory flow đơn giản cho option được recommend. Dùng từ ba đến tám khối có tên và số mũi tên
   ít nhất cần để thấy interaction chính. Đây là hình hỗ trợ đọc, không phải full system diagram: không vẽ class,
   file, endpoint, network zone hay mọi failure topology. Chi tiết để trong prose và trade-off table.
8. Nêu recommendation trước rồi giải thích vì sao option khác thua. Nếu thật sự cần owner input, thu hẹp còn một
   decision sau khi đã dùng hết source evidence và default hữu ích. Recommendation reversible có thể để provisional
   rõ ràng; fork irreversible hoặc security-sensitive không được âm thầm chọn.
9. Kết bằng planning context gọn gồm: project và source revision, business head, objective, decision/status đã chọn,
   fixed constraint, invariant, contract/data bị ảnh hưởng, nghĩa vụ failure và recovery, expectation về
   migration/rollback, proof expectation cùng unknown chưa giải. Không gọi tên implementation file, pattern
   situation hay test filename; những thứ đó thuộc boundary planning kế tiếp.

## Đầu ra bắt buộc cho người đọc

Giữ báo cáo dễ đọc và đúng tỷ lệ. Nó phải có:

- recommendation hoặc exact unresolved decision;
- verified current-state finding;
- một sơ đồ luồng đơn giản;
- bảng trade-off cùng tiêu chí cho 2–4 option khả thi;
- adversarial finding cùng mitigation;
- option bị loại và lý do;
- planning context gọn.

## Điểm dừng

- Product truth cần cho decision bị thiếu hoặc mâu thuẫn: báo exact gap; không giải bằng kỹ thuật.
- Routed source bắt buộc bị thiếu hoặc stale: dừng trước khi tuyên bố current architecture.
- Chỉ còn một implementation shape hợp lý và không có cross-boundary trade-off đáng kể: trả direct answer có
  evidence thay vì brainstorm giả.
- Evidence không phân biệt được option dẫn đầu và khác biệt là irreversible, security-sensitive hoặc đổi cost đáng
  kể: hỏi đúng một owner decision và không đi tiếp vào planning.

## Đầu ra

Trả human analysis rồi đến `PLANNING CONTEXT`, một handoff gọn đã khóa phù hợp cho role-specific planner được
request riêng. Không source write và không liệt kê implementation file.
