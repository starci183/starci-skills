# landing.compose

## Việc

Soạn một contract landing page từ business promise, họ Grammar và visual identity: quyết định mức
áp dụng Grammar, storytelling theo section, loại asset, motion và bằng chứng audit mà không ghi
source hay sinh asset.

## Xong khi

Hoàn tất khi `landing-composition` bind một promise đáng tin và một identity chuẩn, gán ownership
Grammar hoặc custom cho mọi element đã lên kế hoạch, sắp một visual event cho từng section, chọn
ImageGen, SVG, code-native hoặc media có sẵn cho mọi asset slot, cho mỗi motion một trạng thái tĩnh
khi reduced-motion cùng performance budget, và chỉ giao quyền source cho `interface.generate` và
quyền bằng chứng cho `interface.audit`.

## Một contract trước một source writer

Landing page là một chuỗi, không phải một màn hình được trang trí. Các section phải làm một promise
trở nên đáng tin theo thứ tự đọc, và mỗi visual phải đẩy lập luận ấy tiến lên hoặc bị loại. Operator
này nhìn toàn bộ chuỗi và ghi contract một lần. Nó không ghi source ứng dụng, sinh bitmap cuối, ráp
SVG hay khởi động preview. `interface.generate` vẫn là operator duy nhất triển khai và commit cây
frontend.

Ranh giới này là chủ ý. Composition quyết định section phải truyền đạt gì, phần nào Grammar sở hữu,
asset cần medium nào và motion có ý nghĩa gì. Generation quyết định file, cấu trúc component và triển
khai cụ thể dưới contract đó. Audit quan sát kết quả render và phán bằng chứng; nó không redesign
trang trong khi đo.

## Identity là bằng chứng, không phải tính từ phong cách

Visual identity gọi tên một asset chuẩn, brand system có version hoặc mô tả đủ chính xác để loại một
bản trông gần giống. Yêu cầu chỉ nói “premium”, “AI-native” hay một tính từ phong cách khác dừng với
`VISUAL_IDENTITY_MISSING`. Quyết định ImageGen giữ nguyên identity đã nêu và chỉ đổi scene hay medium
render mà brief cho phép. Quyết định code-native hoặc SVG dành cho diagram, path và semantic label
responsive cần giữ khả năng inspect.

## Áp dụng Grammar phải rõ ràng

Adoption matrix ghi mỗi element của landing là `grammar` hay `custom`. Text, action, status, icon và
giá trị semantic bind họ đã publish ở nơi họ sở hữu. Một dòng custom phải nêu lý do narrative khiến
element nằm ngoài ownership đó; “visual hơn” không phải lý do. Custom composition có thể sắp Grammar
primitive, nhưng không dựng lại một composite đã publish.

## Motion có một sự thật tĩnh

Mỗi dòng choreography nêu trigger, thay đổi visual có thứ tự, trạng thái reduced-motion và budget.
Reduced motion hiển thị ngay nghĩa cuối đầy đủ và bỏ drift, parallax, stagger không thiết yếu.
Performance budget giới hạn dung lượng asset, layout stability, observer và thuộc tính animation
trước triển khai. Audit contract biến visual storytelling, motion, reduced motion và performance
thành thứ quan sát được thay vì để chúng là nhận xét thẩm mỹ.

## Ranh giới

Context chỉ đọc. Operator chỉ ghi `response/` của nhánh mình: composition, artifact bind knowledge
khi phát và `response.json`. Nó không ghi routed source, không commit, không sinh ảnh cuối, không
render candidate, không mở server và không publish Grammar.

## Context

| Alias | Bind | Bắt buộc |
| --- | --- | --- |
| `@grammar/core` | catalog Grammar đã publish và các quan hệ ownership adoption matrix có thể bind | có |
| `@knowledge/grammars/<family>` | identity, idiom và playbook chính xác của họ mà landing phải giữ | có |
| `@knowledge/ui/composition` | luật composition điều khiển hierarchy, sequence và cấu trúc responsive | có |
| `@knowledge/ui/presentation` | token presentation semantic và ranh giới ownership | có |
| `@knowledge/ui/proof` | luật proof dùng để làm audit contract quan sát được | có |
| `@workspaces/fe` | frontend đã route tại head đóng băng, chỉ đọc làm bằng chứng hiện trạng | không |

## Đầu vào

| Kind | Từ đâu | Bắt buộc |
| --- | --- | --- |
| `business-promise-authority` | `business.decide`; promise landing phải làm đáng tin | không |
| `surface-map` | `interface.plan`; unit landing và shell chung đã lên kế hoạch khi có | không |
| `knowledge-repair-receipt` | `knowledge.repair`, khi đây là lần thử lại với manifest đã bind lại | không |

## Yêu cầu

| Field | Kiểu | Mặc định | Hỏi |
| --- | --- | --- | --- |
| `surface` | id | — | Route hoặc unit landing mà contract này soạn |
| `promise` | text | null | Promise cụ thể khi không bind đầu vào business-promise-authority |
| `visualIdentity` | list | — | Asset chuẩn, ref brand system hoặc ràng buộc identity rõ ràng |
| `references` | list | [] | Tham chiếu visual hay product và chính xác thứ được mượn từ mỗi cái |
| `motionLevel` | choice | restrained | none, restrained hoặc theatrical; tất cả giữ một sự thật tĩnh reduced-motion |
| `resume` | token | null | Token nhánh bị chặn khi vào lại sau một mã dừng |

## Các bước

| # | Bước | Tham số | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- | --- |
| 1 | Kiểm gate, resume và bằng chứng đã đóng băng | `resume` | `request/request.json`, @workspaces/fe khi bind, @tools/git | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Bind business promise, ưu tiên authority hơn prose của request | `promise` | đầu vào `business-promise-authority`, `request/request.json` | — | `LANDING_PROMISE_MISSING` |
| 3 | Bind identity chuẩn và exact family knowledge | `visualIdentity` | @knowledge/grammars/<family>, các identity ref | `knowledge-coverage`, `family-understanding`, hoặc `knowledge-question` | `VISUAL_IDENTITY_MISSING`, `EVIDENCE_MISSING`, `KNOWLEDGE_QUESTION` |
| 4 | Gán ownership Grammar hoặc custom cho mọi element đã lên kế hoạch | — | @grammar/core, @knowledge/ui/composition, @knowledge/ui/presentation, đầu vào `surface-map` khi có | — | `COMPOSITION_INCOMPLETE` |
| 5 | Sắp storyboard section để mỗi section đẩy promise tiến lên | `references` | promise, identity, source hiện tại và tham chiếu có giới hạn | — | `COMPOSITION_INCOMPLETE` |
| 6 | Chọn medium từng asset và viết brief giữ nguyên identity | — | storyboard, bằng chứng identity, @tools/websearch chỉ cho referent đã nêu | — | `COMPOSITION_INCOMPLETE` |
| 7 | Đặc tả motion, sự thật tĩnh reduced-motion, performance budget và bằng chứng audit | `motionLevel` | storyboard, @knowledge/ui/proof | — | `COMPOSITION_INCOMPLETE` |
| 8 | Phát handoff chỉ đọc cho bề mặt đã gọi tên | `surface` | mọi thứ ở trên | `landing-composition`, `response/response.json` | — |

## Đầu ra

| Kind | File | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| `landing-composition` | `response/response.md` | md | có |
| `knowledge-coverage` | `response/data/knowledge-coverage.json` | data | không |
| `family-understanding` | `response/data/family-understanding.json` | data | không |
| `knowledge-question` | `response/data/knowledge-question.json` | data | không |

## Operator Result

Với composition thành công, `outcome.primary` trỏ tới `landing-composition` đã khai để người đọc có
thể inspect toàn bộ sequence và ownership handoff trước khi source nào được ghi.

## Dừng

| Code | Xử lý |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SOURCE_DRIFT` | terminate |
| `EVIDENCE_MISSING` | terminate |
| `LANDING_PROMISE_MISSING` | terminate |
| `VISUAL_IDENTITY_MISSING` | terminate |
| `COMPOSITION_INCOMPLETE` | terminate |
| `NO_PROGRESS` | terminate |
| `KNOWLEDGE_QUESTION` | terminate |

## Kế tiếp

| Khi | Operator |
| --- | --- |
| composition contract hoàn tất và cần vẽ hướng PNG trước source | `interface.draw` |
| knowledge đã bind mâu thuẫn với bằng chứng identity hoặc reference đã kiểm | `knowledge.repair` |
| landing chưa có business promise có owner | `business.decide` |
