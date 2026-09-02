# Context cho `fe.direction.decide`

## Mục đích

Context là toàn bộ vật liệu chính xác đã có để chốt direction frontend. Nó trả lời câu hỏi “operator
được dùng những gì?” trước khi brainstorm. Context không được mở rộng mission scope và không biến
evidence thành authority.

Operator chỉ đọc các reference được truyền trong top-level `context`. Mỗi reference là immutable trong
invocation và được bind bằng fingerprint `sha256:`. Observation lấy từ source còn phải bind đúng source
head đã quan sát.

## Các lớp context

| Context | Vai trò trong quyết định | Trạng thái authority |
| --- | --- | --- |
| Request | Objective, yêu cầu compare rõ ràng, target, inclusion và exclusion. | Chỉ có authority cho outcome và boundary user đã yêu cầu. |
| Business receipt | Actor, promise, permission, entitlement, negative outcome, recovery và product behavior đã duyệt. | Business authority bắt buộc. |
| Backend receipt | API, state, auth/session, persistence và failure contract mà UI sử dụng. | Technical authority có điều kiện. |
| Architecture receipt | System boundary, data ownership, stack hoặc topology ràng buộc UI. | Technical authority có điều kiện. |
| Grammar đã publish | Reusable component, composition, token, state, responsive interface và semantic role. | Reusable UI authority bắt buộc. |
| Knowledge | Luật UX/UI trung lập, accessibility guidance, direction guidance và product Grammar knowledge. | Guidance và reusable law, không sở hữu product behavior. |
| Frontend source | Target hiện tại, route-local layout, owner lồng trực tiếp, shared consumer và test/story liên quan. | Evidence của implementation hiện tại, không phải authority cho direction mới. |
| Product-family source | Sibling surface và shared visual signature như hierarchy, shell rhythm, navigation, semantic color. | Evidence về family coherence, không phải template. |
| UAT | Observation behavior, UX và UI trước đó, gồm failure/recovery path. | Evidence và counterevidence; PASS cũ không phải authority hiện tại. |
| Owner audit | Lịch sử `audit.md` cạnh page, layout, modal hoặc drawer owner. | Evidence và regression history. |
| Visual evidence | Screenshot, render, benchmark raster hoặc counterexample user cung cấp. | Chỉ là pixel evidence. |
| Previous direction | Decision receipt và artifact cũ. | Chỉ là evidence nếu thiếu đúng direction identity, fingerprint và direction-specific approval. |
| External reference | Research có giới hạn cho domain hoặc interaction model còn lạ. | Chỉ là evidence; không phải layout, brand hay business template. |

## Context bắt buộc

Mọi invocation cần:

1. ít nhất một request reference;
2. một accepted business receipt khớp project và target scope;
3. một published Grammar binding;
4. ít nhất một knowledge reference áp dụng được;
5. frontend source context chính xác của project, kể cả khi target là mới.

Backend và architecture receipt là bắt buộc khi direction consume hoặc thay contract thuộc các domain
đó. Thiếu receipt phải trở thành typed gap; operator không được tạo fixture, fake control, state tự bịa
hay behavior chỉ để trình diễn.

## Ref

| Alias | Trỏ tới | Bind | Bắt buộc |
| --- | --- | --- | --- |
| `@receipt/business-promise-authority/<invocationId>` | `<@artifacts of invocation <invocationId>>/<receiptType>.json  (the receipt file that invocation registered in output.artifactRefs)` | fingerprint + the sourceHead the receipt binds | Bắt buộc: Business authority for the requested outcome. |
| `@receipt/backend-implementation/<invocationId>` | `<@artifacts of invocation <invocationId>>/<receiptType>.json  (the receipt file that invocation registered in output.artifactRefs)` | fingerprint + the sourceHead the receipt binds | Tuỳ chọn: Technical authority when the direction touches a delivered contract. |
| `@receipt/architecture-decision/<invocationId>` | `<@artifacts of invocation <invocationId>>/<receiptType>.json  (the receipt file that invocation registered in output.artifactRefs)` | fingerprint + the sourceHead the receipt binds | Tuỳ chọn: Technical authority when boundaries are in question. |
| `@grammar` | `the @starci/grammar package as the bound app resolves it: file:packages/grammar inside @workspaces/fe today (source 0.4.0), or @npm/@starci/grammar@<version> (0.3.0 published); the receipt records which` | package.json version + the resolved location's fingerprint (checkout head for file:, tarball integrity for npm) | Bắt buộc: Published Grammar: the compositions a direction may bind. |
| `@knowledge/grammars/starci` | `<Source>/.claude/knowledge/grammars/  (one folder per family: @knowledge/grammars/starci)` | fingerprint per file; rule inventory = every `## PREFIX-n` heading in the folder | Tuỳ chọn: Family realization rules: how the Core family is meant to realize Common. Law about the Grammar, never the Grammar itself. |
| `@knowledge/ui/composition` | `<Source>/.claude/knowledge/ui/  (composition/, presentation/, proof/; a sub-path narrows: @knowledge/ui/presentation)` | fingerprint per file; rule inventory = every `## PREFIX-n` heading in the folder | Bắt buộc: What a tree must contain before it exists. |
| `@workspaces/fe` | `<checkout:input.project.id/fe>  (diskPath from <Source>/.workspaces/local/routes/<project>/fe/config.json); a sub-path narrows: @workspaces/fe/.husky, @workspaces/fe/package.json#scripts` | fingerprint + sourceHead (git rev-parse HEAD of the checkout) | Bắt buộc: Current implementation as evidence, never as the requested direction. |
| `@worktrees/uat/<flow>/<case>` | `<Source>/.worktrees/uat/<flow>/<case>/  (snapshot.json, result.json)` | fingerprint of snapshot.json and result.json | Tuỳ chọn: Evidence and counterevidence; a prior PASS is not current authority. |
| `@receipt/fe-direction-decision/<invocationId>` | `<@artifacts of invocation <invocationId>>/<receiptType>.json  (the receipt file that invocation registered in output.artifactRefs)` | fingerprint + the sourceHead the receipt binds | Tuỳ chọn: A previous direction; evidence unless the exact identity and fingerprint match. |
| `@artifacts` | `input.project.artifactRootRef; convention <Source>/.worktrees/sessions/<invocationId>/artifacts/  (receipt, named artifacts, captures)` | fingerprint per artifact; every artifact written is registered in output.artifactRefs | Bắt buộc: Where candidate renders and the decision receipt are written. |

## Luật chọn context

- Đọc target hiện tại với `modify`, `audit-repair` và `reconcile`. Với `new`, verify target chưa tồn tại
  và chỉ quan sát host cùng product-family context đã được cấp authority.
- Chỉ đọc sibling surface chứng minh một shared relationship liên quan. Không copy page.
- Dùng UAT và audit để tìm state, regression và counterevidence. Không kế thừa verdict của chúng.
- Chỉ research bên ngoài khi business authority và product-family evidence chưa giải thích được cách
  user nhận ra offer, ra quyết định, hiểu risk, hoàn thành task hoặc recovery.
- Dừng research khi material interaction pattern đã hội tụ, hoặc sau một lần mở rộng tìm kiếm vẫn chỉ
  gặp evidence inaccessible, duplicate, irrelevant hay không material.
- Thiếu reusable component, token, state hoặc responsive interface là `GRAMMAR_REQUIRED`, không phải cơ
  hội styling cục bộ.

## Kỷ luật quan sát

Quan sát artifact trực tiếp trước producer rationale. Ghi fact nhỏ nhất áp dụng được cùng exact
reference. Code hiện có, test xanh, DOM, measurement, screenshot và PASS cũ có thể support hoặc phản
bác claim, nhưng không được tự trở thành business/direction authority vì đã tồn tại.

Mọi proposal material phải có disposition add/change/remove. Direction không hợp lệ khi còn business
contradiction, owner leak, Grammar invention, responsive/accessibility failure, adverse state chưa giải
quyết hoặc một reversible alternative mạnh hơn rõ ràng.

## Ranh giới

Operator chỉ được đọc context reference đã khai báo. Nó chỉ được ghi receipt và inspectable visual
artifact dưới `input.project.artifactRootRef`. Product source, business head, backend contract,
architecture decision, Grammar package, UAT và audit history đều read-only.

## Tài nguyên

Operator này chạy trọn trên profile `sol-fresh` (`gpt-5.6-sol`, runtime `openai`), khai dưới `resources` trong `operator.json` và được `scripts/validate-resources.mjs` kiểm. Quyền nó cần: tìm trên mạng, trình duyệt. Nó được tìm trên mạng trong giới hạn đúng khoảng trống phải lấp, có ghi lại, tuân thủ Grammar đã publish, và chỉ sinh artwork sản phẩm khi thẩm quyền sản phẩm gọi tên. Một quyền không nằm trong `requires` thì không dùng được dù profile có cho phép.
