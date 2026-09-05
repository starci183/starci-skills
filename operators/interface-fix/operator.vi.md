# interface.fix

## Việc

Sửa một phát hiện — một dòng verdict của audit, hoặc một verdict UAT — trên bề mặt đã sinh bằng một
commit nhỏ trên nhánh phiên: trong cỡ fix của orchestrator, không đổi bố cục, và mọi giá trị lấy từ
kho resolution mà bề mặt đã được sinh ra từ đó.

## Xong khi

Xong khi, dưới mode apply, `frontend-source-application` cùng `changes` của nó ghi nhận đúng một
commit trên nhánh phiên sửa đúng một phát hiện mà request đã bind, mà `writes` ghi mọi đường dẫn đã
khai với hash trước và sau, chạm không quá cỡ fix của orchestrator cho phép, không tạo và không xoá gì,
chỉ mang class mà kho của resolution đã bind công bố và một lượt quét trình bày sạch, và cây đọc lại
tại commit là bản chiếu; hoặc, dưới mode dry, `writes` mang kế hoạch với commit null và checkout
không bị đụng tới.

## Một phát hiện, một commit nhỏ

Một fix là câu trả lời hợp luật nhỏ nhất cho một phát hiện: một dòng trong bảng verdict của audit gọi
tên một node và một luật, hoặc một bước trong verdict UAT gọi tên điều hành trình đã gặp. Phát hiện
tới dưới dạng biên nhận đã nêu nó, và request gọi tên đúng một dòng mà nhánh này trả lời; một fix trả
lời hai phát hiện là hai fix, và một fix trả lời một phát hiện không ai nêu là một thay đổi không ai
yêu cầu. Biên nhận gọi tên phát hiện ở dòng `Finding` trong `## Binding`, theo đúng dạng biên nhận đã
nêu dùng, để người đọc đi được từ verdict tới commit và ngược lại.

## Cỡ là của orchestrator

Thứ tách một fix khỏi một lần sinh lại là cỡ, và con số ấy không thuộc về operator này: orchestrator
công bố nó là `fixSize` trong tài nguyên của chính nó, và validator đọc ở đó khi nó có mặt. Trong cỡ
ấy, một lần sửa là một fix; ngoài cỡ ấy nhánh dừng với `FIX_TOO_LARGE` và phát hiện đi ngược về
`interface.generate`, nơi quyết lại một hướng thay vì vá một bố cục mỗi lần ba file. Operator này không
ghi cứng ngưỡng nào: một cây mà orchestrator không công bố ngưỡng thì chỉ được kiểm theo hình dạng, và
hình dạng là nửa còn lại của luật.

## Loại và độ kiên nhẫn cũng là của orchestrator

Cỡ không phải ranh giới duy nhất. Cùng tài nguyên ấy gọi tên những loại phát hiện không bao giờ là
một fix dù miếng vá có nhỏ đến đâu — các topic của `knowledge/ui` nó liệt kê dưới `generateTopics`,
các tiền tố rule nó liệt kê dưới `generatePrefixes` — vì một phát hiện về composition hay về gu là một
quyết định về bề mặt chứ không phải về một giá trị, và quyết định là của `interface.generate`. Nó cũng
gọi tên một phát hiện được fix bao nhiêu lần: quá `escalateAfter` nhánh fix cho cùng một phát hiện
trong một phiên, lần sửa kế tiếp là của bộ sinh chứ không phải một fix nữa, vì một phát hiện sống sót
qua một lần fix đang nói với cây rằng fix là sai công cụ. Cả hai lời từ chối đều thuộc cổng request
(`scripts/validate-request.mjs#fixKindErrors`) và cả hai dừng nhánh với `FIX_TOO_LARGE` trước khi một
agent được dispatch.

## Không đổi bố cục

Một fix không dịch chuyển cấu trúc. Nó không tạo path và không xoá path: một lá mới hay một nhánh bị
bỏ là một quyết định composition, và quyết định composition là của `interface.generate`. Nó không ghi
class nào mà kho của resolution đã bind không công bố: kho đóng băng cùng cây đã sinh là toàn bộ tập
giá trị bề mặt này được mang, nên một giá trị mà phát hiện có vẻ cần mà kho không có thì không phải
một fix mà là một câu hỏi resolution, và nhánh dừng với `FIX_TOO_LARGE` thay vì bịa ra. Kho mà request
bind được đọc cạnh cây đã resolve mà nó được đóng băng cho, và một fingerprint không còn khớp cây đó là
`RESOLUTION_STALE`.

## Cùng luật ghi với bộ sinh

Mọi thứ nửa ghi của bộ sinh từ chối, operator này cũng từ chối, dưới cùng các mã: một path ngoài write
set đã khai hay ngoài gốc owner của nó, một class vắng mặt trong kho, một phát hiện của lượt quét trên
bản chiếu, một cây đã commit không phải bản chiếu — mỗi thứ là `WRITE_REJECTED` hay `OWNER_CONFLICT`
đúng như bộ sinh định nghĩa, lượt quét trình bày chạy trên write set đã chiếu qua `@tools/shell` trước
khi ghi bất cứ thứ gì, và lần ghi đáp xuống `session/<sessionId>` của checkout được route trong đúng
một commit mà `response.json` mang sha của nó dưới `commits`. Không ghi gì bên ngoài một phiên: một lần
gọi không có `step-N/parallel-M` nào dưới một phiên thì dừng với `SESSION_MISSING`.

## Ranh giới

Operator ghi các path trong write set đã khai trên nhánh phiên của `@workspaces/fe`, mỗi path nằm dưới
một gốc owner được sửa, và `response/` của nhánh mình. Nó không quyết hướng, không resolve giá trị,
không đổi cây đã resolve hay kho của nó, không tạo hay xoá path, không ghi class mà kho không công bố,
không trả lời nhiều hơn một phát hiện, không sửa knowledge, không publish Grammar, không push, không
merge, và không ghi phán quyết, điểm số hay tuyên bố pass lên source đã sửa: bề mặt được audit hay đi
lại sau đó. Nó không bao giờ stash, reset, force, clean, rebase hay checkout sang nhánh khác bên trong checkout được route, và không xoá bằng tay bất cứ thứ gì dưới một checkout có `node_modules` là junction — một worktree tạm được gỡ bằng `git worktree remove --force`. `## Binding` của `changes.md` là nơi đọc hai luật ấy: `Preflight` dạng `<passed|failed> at <ISO 8601 instant>`, còn `Reflog before` và `Reflog after` dạng `HEAD <reflog entries> <head sha>; stash <reflog entries>` (orchestrator.json#sourceWrites).
## Context

| Alias | Bind | Bắt buộc |
| --- | --- | --- |
| `@workspaces/fe` | checkout frontend được route ở commit mà phát hiện được nêu trên đó; lần ghi đáp xuống nhánh phiên của nó và không đâu khác | có |
| `@knowledge/ui/presentation` | kho luật đóng, chỉ đọc để xác nhận các identifier mà kho đã bind mang vẫn còn được publish | không |

## Đầu vào

| Kind | Từ đâu | Bắt buộc |
| --- | --- | --- |
| `frontend-presentation-resolution` | `interface.generate`, biên nhận mà cạnh nó kho và cây đã resolve mà fix này lấy giá trị đã được đóng băng | có |
| `frontend-source-application` | `interface.generate`, hoặc `interface.fix` trước đó; commit mà phát hiện được nêu trên đó | có |
| `frontend-surface-audit` | `interface.audit`, khi phát hiện là một dòng trong bảng verdict của nó | không |
| `uat-flow-verification` | `uat.verify`, khi phát hiện là một bước trong verdict của nó | không |

## Yêu cầu

| Field | Kiểu | Mặc định | Hỏi |
| --- | --- | --- | --- |
| `finding` | id | — | Đúng một phát hiện mà fix này trả lời, theo cách biên nhận đã nêu gọi tên nó: `<matrixId>/<node>/<rule>` cho một dòng verdict audit, `<runId>/<step>` cho một verdict UAT |
| `mode` | choice | apply | `apply` ghi rồi commit, `dry` chỉ phát bản kế hoạch và không ghi gì |
| `resume` | token | null | Token của nhánh bị chặn khi vào lại sau một mã dừng |

## Các bước

| # | Bước | Tham số | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- | --- |
| 1 | Kiểm gate và chạy lại, xác nhận phiên và head đóng băng, và chạy preflight của request trước lần ghi đầu ra ngoài thư mục phiên | `resume`, `mode` | `request/request.json`, `state.json` của phiên và `step-N/parallel-M` của nhánh này, @workspaces/fe ở head đóng băng | — | `INVALID_INPUT`, `SESSION_MISSING`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Bind đúng một phát hiện vào dòng đã nêu nó, và kho vào cây nó được đóng băng cho | `finding` | đầu vào `frontend-surface-audit` hoặc `uat-flow-verification` (dòng mà phát hiện gọi tên), `frontend-source-application` (commit nó được nêu trên đó), `frontend-presentation-resolution` (kho cạnh nó và cây đã resolve), @knowledge/ui/presentation | — | `RESOLUTION_STALE` |
| 3 | Chiếu lần sửa nhỏ nhất lên write set đã khai và đo nó theo cỡ fix | — | @workspaces/fe (các path đã khai và gốc owner của chúng), kho, `fixSize` của orchestrator khi nó công bố | — | `OWNER_CONFLICT`, `FIX_TOO_LARGE` |
| 4 | Đối chiếu mọi giá trị đã chiếu với kho, rồi quét bản chiếu | `mode` | kho, @workspaces/fe (write set đã chiếu), @tools/shell | `writes` | `WRITE_REJECTED` |
| 5 | Ghi nguyên khối trên nhánh phiên, commit một lần rồi đọc lại cây ở commit | — | @workspaces/fe (nội dung hiện tại của từng path đã khai, dưới một lease độc quyền, rồi cây ở commit) | @workspaces/fe/branch/session, `writes`, @tools/sourcewrite, @tools/git | `WRITE_REJECTED` |
| 6 | Phát | — | mọi thứ ở trên | `response/response.md`, `response/changes.md`, `response/response.json` | — |

Dưới `mode = dry`, nhánh dừng sau bước 4 với riêng bản kế hoạch: `writes.json` mang commit rỗng,
`response.json` không mang commit nào, và checkout y nguyên; một lượt dry không được cấp
`@tools/sourcewrite` lẫn `@tools/git`. `changes.md` là bản ghi mà các bước sau đọc: path nào đã dịch
chuyển, chúng mang lời khai nào, và bề mặt nào phải được đo hay đi lại.

## Đầu ra

| Kind | File | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| `frontend-source-application` | `response/response.md` | md | có |
| `changes` | `response/changes.md` | md | có |
| `writes` | `response/data/writes.json` | data | có |

## Dừng

| Code | Xử lý |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SESSION_MISSING` | terminate |
| `SOURCE_DRIFT` | terminate |
| `RESOLUTION_STALE` | terminate |
| `OWNER_CONFLICT` | terminate |
| `FIX_TOO_LARGE` | terminate |
| `WRITE_REJECTED` | terminate |
| `NO_PROGRESS` | terminate |

## Kế tiếp

| Khi | Operator |
| --- | --- |
| fix đã commit và bề mặt phải được đo lại | `interface.audit` |
| fix đã commit và các cổng của chính checkout phải chạy | `quality.verify` |
| fix đã commit và head phải được phục vụ trước khi được đo | `runtime.serve` |
| fix đã commit và một phát hiện mà owner thư viện đã sửa phải được tiêu thụ ở đúng version | `library.update` |
| fix đã trả lời một verdict UAT và hành trình phải được đi lại | `uat.verify` |
