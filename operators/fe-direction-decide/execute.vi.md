# Thực thi `fe.direction.decide`

## Một việc duy nhất

Biến input đã validate cùng exact context thành một typed frontend direction receipt. Đây là một
operator invocation tuyến tính. Nó không gọi operator khác, không route workflow, không pause bên
trong và không implement.

## Trình tự

| # | Bước | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- |
| 1 | Validate input và resume | input, `@dynamic/fe-direction-decision.json`, `@workspaces/fe` (binding head đã đóng băng) | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Bind authority | input (request, project, target, change level, owner ceiling), `@dynamic/business-promise-authority.json`, `@dynamic/backend-implementation.json`, `@dynamic/architecture-decision.json`, `@grammar/core` | — | `ROUTE_UNVERIFIED`, `SCOPE_UNFROZEN`, `CHANGE_LEVEL_AMBIGUOUS`, `OWNER_CEILING_INVALID`, `BUSINESS_REQUIRED`, `BACKEND_REQUIRED`, `ARCHITECTURE_REQUIRED` |
| 3 | Quan sát context hiện có | `@workspaces/fe` (artifact trực tiếp của target, hoặc host và product family được cấp authority), ``, `@worktrees/uat/<flow>/<case>` | — | `EVIDENCE_MISSING` |
| 4 | Compile một UI contract | `@knowledge/ui/composition`, `@dynamic/business-promise-authority.json`, `@workspaces/fe` (context đã quan sát) | — | — |
| 5 | Giải quyết nhu cầu reference | input (các exact reference bên ngoài), `@knowledge/ui/composition` (khoảng trống cần lấp) | — | `REFERENCE_EVIDENCE_EXHAUSTED` |
| 6 | Tạo candidate | `@knowledge/ui/composition` (UI contract đã compile), input (change level, quyền so sánh) | — | `NO_VIABLE_DIRECTION` |
| 7 | Áp dụng Grammar filter | `@grammar/core` (component sở hữu gì và có những prop nào), `@knowledge/grammars/starci` (luật hiện thực hoá của family), input (owner ceiling) | — | `GRAMMAR_REQUIRED` |
| 8 | Render decision evidence | `@grammar/core`, `@knowledge/ui/composition` (UI contract mà các candidate còn lại phải trả lời) | `@dynamic/<candidateId>.html` | — |
| 9 | Falsify | `@dynamic/<candidateId>.html`, `@dynamic/business-promise-authority.json`, `@dynamic/backend-implementation.json` | — | — |
| 10 | Chốt hoặc block | `@dynamic/<candidateId>.html`, input (chế độ đang chạy) | — | `DIRECTION_CHOICE_REQUIRED` |
| 11 | Phát output rồi dừng | tất cả những gì ở trên | `@dynamic/fe-direction-decision.json` | — |

Khâu validate từ chối authority stale, source drift, owner overlap, tổ hợp change level sai, compare
chưa được cấp quyền và progress không đổi. Evidence có thể phản bác authority nhưng không bao giờ thay
được authority. Việc quan sát lấy các artifact trực tiếp mà không nhận producer rationale làm đáp án:
một target đã có thì cho ra regions, actions, states, responsive behavior và owner boundary hiện tại,
còn một target mới thì phải được verify là chưa tồn tại trước khi chỉ host và product family được cấp
authority được quan sát.

UI contract khoá purpose, actor task, representative content, region responsibility, thứ tự thông tin
và hành động, state matrix đóng, exit, responsive rule, accessibility obligation, Grammar binding, các
quyết định giữ lại, các quyết định thay đổi và non-goal. Phần research bên ngoài có giới hạn ghi lại
relationship hữu ích cùng limitation của chúng và không bao giờ copy page, brand, palette hay
component anatomy; khi evidence không chốt được một business hay interaction decision, invocation dừng
lại cùng owning gap.

`refine` giữ nguyên cấu trúc đã duyệt và một lần approved-direction reuse chính xác thì giữ nguyên
direction triple được cung cấp; ngoài hai trường hợp đó, bước này tạo một dominant reversible
candidate, hoặc đúng ba tới bốn candidate khác biệt material trong compare mode đã được cấp quyền.
Grammar filter reject mọi candidate tự bịa shared interface còn thiếu, vượt owner ceiling, mô phỏng
Grammar chưa publish trong source cục bộ, hoặc trái một published composition.

Một candidate `new` hay `reconstruct` được generate thì phải render thành page hay substantial surface
thực tế, có representative content, composition wide và constrained, cùng ít nhất một trạng thái
pending, failure, recovery hay boundary quan trọng; compare mode render mọi alternative trong cùng một
inspectable artifact và làm rõ material difference. Khâu falsify tấn công business và backend
conformance, hierarchy, content density, action feedback, recovery, responsive reflow, content stress,
keyboard và focus, accessibility, family coherence, reversibility và owner leakage, rồi ghi các
disposition add, change, remove cùng contradiction của chúng. Khâu chốt chọn candidate hợp lệ trội hơn
material trong dominant mode; trong compare mode, hoặc khi còn nhiều candidate hợp lệ mà không có đáp
án trội hơn, nó trả về đúng ba tới bốn alternative thay vì chọn theo gu. Khâu phát output bind mọi
fingerprint source, authority, context, scope, artifact, input và progress, không mutate source và
không claim downstream proof.

## Thực thi khi resume

Resume bắt đầu lại tại validation, chỉ reuse observation/artifact còn nguyên fingerprint, rồi consume
exact delta. Alternative selection phải là candidate trong blocked receipt và có exact product
authority. Operator không brainstorm lại trước khi phát selected decision. Resume stale hoặc không có
delta trả `NO_PROGRESS` hay failure stale-binding tương ứng.

## Các đòn tấn công bắt buộc

Operator không được chốt khi còn bất kỳ mục áp dụng nào chưa giải quyết:

- business state hay recovery path chưa có UI representation;
- action thiếu pending, success/failure feedback hoặc recovery;
- proposal thay API, auth, persistence hay data assumption;
- mutable region thuộc excluded owner;
- reusable pattern chưa có trong Grammar đã publish;
- wide/constrained transformation thiếu hoặc mâu thuẫn;
- keyboard, focus, label, contrast intent hay reading order chưa chốt;
- representative content, multi-item behavior, long content, empty/error state hay boundary behavior
  làm direction hỏng;
- tồn tại reversible candidate mạnh hơn material nhưng chưa được đánh giá.

