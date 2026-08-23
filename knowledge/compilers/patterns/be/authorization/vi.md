---
title: Authorization · Vietnamese
---

# Phân quyền

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-be` | `@starci/eslint-canon-be` | npm package | bộ máy backend đã phát hành mà bản ghi này viện dẫn |


## Bản ghi

Pattern này nhận một shape đã được duyệt: một operation đã có người chốt — mutation, query, subscription,
job hay webhook — kèm theo chủ thể mà nó phục vụ và bản ghi mà nó với tới. Pattern này không mở lại
quyết định đó. Nó trả về kiến trúc source: file nào mang guard, file nào mang phép so sánh
quyền sở hữu, lời từ chối được gọi tên là gì, và tầng nào phải hoàn toàn không biết đến câu chuyện
này.

## Luật

Xác thực (authentication) hỏi **người này là ai**. Phân quyền (authorization) hỏi **người này có được
làm việc này trên đúng bản ghi này không**. Hai câu hỏi khác nhau nên được trả lời ở hai chỗ khác
nhau: một câu không cần đọc dữ liệu, còn câu kia thì có.

Guard nhìn thấy request. Nó xác minh token, dựng được user, từ chối người vô danh — và chỉ đến đó,
vì bản ghi mà người gọi đang với tới **chưa được load**. Người này có sở hữu bản ghi kia không, có
đang giữ quan hệ đã trả tiền không, có thuộc tenant sở hữu dòng dữ liệu đó không — đều là câu hỏi về
một **dòng dữ liệu**, và chỉ handler mới cầm cả dòng dữ liệu lẫn danh tính cùng một lúc.

Câu hỏi quyết định một check nằm ở đâu: **câu trả lời có phụ thuộc vào dữ liệu của request không?**
"Có ai đang đăng nhập không" thì không — đó là việc của cửa. "Người này có được sửa **cái đó** không"
thì có — đó là việc của handler.

**Đây là luật bắt buộc, không phải lời khuyên.** Mọi cửa đọc danh tính và mọi handler chạm tới một
bản ghi đều rơi vào đúng một mã dưới đây. Không có operation nào nhỏ đến mức được miễn: một mutation
xoá một dòng là `AUTHZ-3`, đúng cùng một lý do mà một query nội dung trả phí là `AUTHZ-5`. Câu "có mỗi
mutation nội bộ thôi mà" là chỗ luật này bị bỏ qua nhiều nhất — vì mutation nội bộ chính là cái sau
này mọc thêm caller thứ hai.

Phần lớn luật này máy không kiểm được, và bảng **Tầng giữ** bên dưới nói thẳng điều đó thay vì ngụ ý
rằng mọi mã đều được canh như nhau. Phân quyền quyết định trên một dòng dữ liệu; parser không biết
handler đang với tới dòng nào và "sở hữu" dòng đó nghĩa là gì.

## Mã tình huống

Mọi tình huống module này quản đều mang một mã `AUTHZ-<n>`. Các con số là CỐ ĐỊNH: chúng được trích
dẫn từ những luật anh em và từ các bản ghi công việc cũ, nên đánh số lại sẽ âm thầm làm hỏng một
trích dẫn ai đó đã viết.

| Mã | Tình huống | Source phải trông như thế nào |
|---|---|---|
| `AUTHZ-1` | Handler tự khai điều kiện tiên quyết của nó, kể cả khi cửa đã có guard | Đòi hỏi: handler tự kiểm tra điều kiện danh tính của mình, đứng trên mọi cổng khác. Cấm: xoá `if (!user)` của handler với lý do resolver đứng trước đã mang guard |
| `AUTHZ-2` | Một cửa có đọc danh tính | Đòi hỏi: method đọc user đã xác thực phải mang guard ở chính method đó hoặc ở class của nó. Cấm: một cửa đọc tham số danh tính trong khi không method lẫn class nào dựng ra danh tính ấy |
| `AUTHZ-3` | Quyền sở hữu quyết định trên dòng đã load, không trên request | Đòi hỏi: dòng dữ liệu được load, và quyền sở hữu so với chủ sở hữu của chính dòng đã load. Cấm: so sánh hai id đều do người gọi cung cấp, hoặc tin vào một owner id đi trong request |
| `AUTHZ-4` | Từ chối bằng câu nào là một quyết định có chủ đích | Đòi hỏi: lời từ chối gọi tên nó là sự thật nào — forbidden hay not-found — và bản ghi riêng tư thì từ chối bằng not-found. Cấm: trả "forbidden" cho bản ghi mà người gọi lẽ ra không thể biết là có; trả "not found" ở chỗ người gọi biết bản ghi một cách chính đáng |
| `AUTHZ-5` | Entitlement là một trạng thái; dòng quan hệ không phải trạng thái đó | Đòi hỏi: câu query gọi tên đúng cột phân biệt trạng thái được quyền với dòng chỉ đơn thuần có quan hệ. Cấm: coi sự tồn tại của dòng quan hệ là entitlement |
| `AUTHZ-6` | Operator, service token và người dùng sản phẩm là ba chủ thể khác nhau | Đòi hỏi: một guard cho một chủ thể — người dùng sản phẩm, người vận hành nền tảng, service token. Cấm: treo operator, service token và người dùng sản phẩm lên cùng một guard |

Sáu mã, và dừng ở sáu. Một tình huống thật sự không có mã là một thay đổi luật được ghi lại, không
phải con số thứ bảy thêm vào cho tiện.

## Đọc một shape đã duyệt

1. **Đọc những gì shape đã nói.** Nó nói loại operation, chủ thể nó phục vụ, và bản ghi mà operation
   với tới. Ba sự thật đó đã chốt; đừng thương lượng lại ở đây.
2. **Đọc những gì shape không nói, và do đó không giải quyết.** Shape hiếm khi nói guard nào dựng ra
   danh tính, cột nào trên dòng đã load mang quyền sở hữu, cột nào phân biệt trạng thái được quyền,
   hay người gọi có thể biết bản ghi tồn tại hay không. Mỗi thứ đó là một đầu vào phải được cấp trước
   khi pattern này sinh ra được một file.
3. **Giải quyết từ ngoài vào trong.** Bắt đầu ở cửa: method này hoặc class của nó có đọc danh tính
   không, và cái gì dựng ra danh tính ấy (`AUTHZ-2`, và `AUTHZ-6` cho câu hỏi guard của chủ thể nào).
   Rồi mới đi vào handler: điều kiện tiên quyết của chính nó (`AUTHZ-1`), dòng đã load (`AUTHZ-3`),
   trạng thái được quyền (`AUTHZ-5`), và cuối cùng là cách gọi tên lời từ chối (`AUTHZ-4`).
4. **Hỏi đúng câu hỏi của từng mã.** `AUTHZ-1`: nếu ngày mai có caller thứ hai gọi thẳng handler này
   mà không đi qua cửa cũ, operation còn an toàn không? `AUTHZ-2`: cái gì đã chứng minh rằng danh tính
   cửa này đọc thuộc về người gọi? `AUTHZ-3`: check này có đọc thứ gì mà người gọi **không** tự chọn
   được không? `AUTHZ-4`: nếu tôi lặp id và chỉ đọc **mã lỗi**, tôi có học được điều gì mình không
   được phép biết không? `AUTHZ-5`: nếu hệ thống tự tạo dòng quan hệ này cho mọi khách ghé qua, check
   của tôi còn từ chối được ai? `AUTHZ-6`: nếu một người dùng sản phẩm được nâng quyền trong phạm vi
   tổ chức của họ, họ có với tới được cửa này không?
5. **Khi hai mã cùng khớp.** Chúng không phải hai lựa chọn thay thế nhau — một operation bình thường
   mang nhiều mã, mỗi mã ở một vị trí file. `AUTHZ-1` là điều kiện tiên quyết độc lập với cửa, nằm
   trong handler; `AUTHZ-2` là chính cái cửa. `AUTHZ-3` quyết định **có từ chối không**; `AUTHZ-4`
   quyết định **từ chối bằng câu nào**. `AUTHZ-2` hỏi **có guard hay không**; `AUTHZ-6` hỏi **guard
   của chủ thể nào** — một cửa operator gắn guard người dùng thì thoả `AUTHZ-2` và vi phạm `AUTHZ-6`.
   Hãy sinh một khối đầu ra cho mỗi mã, và để `reason` của từng khối gọi tên sự thật loại trừ mã kề
   bên.

## `AUTHZ-1` — handler tự sở hữu điều kiện tiên quyết của nó

**Khi nào gặp.** Handler nhận `user` trong command và tự kiểm tra `user` có tồn tại không, dù resolver
đứng trước đã gắn guard. Người đọc sau có thể thấy hai lớp kiểm tra và tưởng chúng là thừa.

**Source phải thể hiện gì.** Một lời từ chối `if (!user)` ở đầu `process` của handler, đứng trên
phần validate rẻ tiền và trên mọi query, trong một handler mà resolver của nó đã có guard. Chính chỗ
thừa đó là mã này. Luật phân quyền nằm trong handler, chỗ mà caller thứ hai với tới được — không nằm
trong service cạnh handler, vì service không có message nên cửa sau sẽ mọc bản sao của riêng nó.

**Cách nhận ra.** Handler nằm sau một bus (command bus, query bus, event bus), không nằm sau
một cửa duy nhất. Cùng một command đã hoặc sẽ được gọi từ CLI, từ job, từ test harness, từ một
transport khác. Người review đề nghị "bỏ cái `if (!user)` đi cho gọn, resolver có guard rồi".

**Ranh giới.** Nó không phải `AUTHZ-2`: mã kia nói về **cửa**, chỗ danh tính được dựng ra; mã này nói
về **handler**, chỗ danh tính được dùng, và một hệ thống đúng có cả hai chứ không chọn một. Nó cũng
không phải `AUTHZ-3`: `AUTHZ-1` chỉ hỏi "có ai không". Ngay khi câu hỏi thành "có phải người này
không" thì đã sang `AUTHZ-3`, và câu đó cần một dòng dữ liệu.

**Tình huống nghiệp vụ hay gặp.** Command handler viết dữ liệu; job chạy lại một mutation cho đơn
tồn; CLI backfill gọi cùng một handler; saga gọi lại bước đã fail; e2e gọi qua transport thật; harness
gọi thẳng handler để đo một nhánh.

## `AUTHZ-2` — cửa nào đọc danh tính thì cửa đó mang guard

**Khi nào gặp.** Một resolver method (hoặc controller method) có tham số đọc user đã xác thực, nhưng
không method nào và không class nào gắn guard. Code vẫn compile, vẫn chạy, handler vẫn nhận được một
thứ gọi là `user`.

**Source phải thể hiện gì.** Một decorator guard trên chính method đọc danh tính, hoặc trên class
của nó: `@UseGuards(...)` đứng trên tham số đọc user. Lint rule `identity-needs-guard` (export
`identityNeedsGuard`, trong `@canon-be`) đếm ba parameter decorator là những cái
đọc danh tính — `IDENTITY_PARAM_DECORATORS` — và leo từ method lên class của nó qua `hasGuard`.

**Cách nhận ra.** Có decorator tham số đọc danh tính, không có decorator guard ở method lẫn ở
class. Cửa mới thêm được copy từ một cửa cũ, và dòng guard bị rơi lúc copy. Lỗi **không nhìn thấy
được**: không exception, không log, không 401 — chỉ là một danh tính không ai chứng minh.

**Ranh giới.** Nó không phải `AUTHZ-1`, vì mã kia sống trong handler chứ không ở cửa. Nó cũng không
phải `AUTHZ-6`: `AUTHZ-2` hỏi **có guard hay không**, `AUTHZ-6` hỏi **guard của chủ thể nào** — một
cửa operator gắn guard người dùng thì thoả `AUTHZ-2` và vi phạm `AUTHZ-6`. Đây là mã duy nhất trong
module có lint rule, vì câu hỏi trả lời được trong phạm vi **một file**: method này, hoặc class của
nó, có mang guard không. Không cần biết dòng dữ liệu nào cả.

**Tình huống nghiệp vụ hay gặp.** Mutation mới copy từ mutation cũ; resolver tách ra khỏi một class đã
có guard ở cấp class; controller webhook thêm tham số user "cho tiện log"; subscription resolver;
query đọc dữ liệu riêng của người gọi.

## `AUTHZ-3` — quyền sở hữu quyết định trên dòng đã load

**Khi nào gặp.** Request chỉ ra bản ghi nào, chứ không nói bản ghi đó **của ai**. `request.reviewId` là
bản ghi người gọi **gọi tên**, không phải bản ghi người gọi **sở hữu**.

**Source phải thể hiện gì.** Một `findOne` theo id được yêu cầu, một not-found khi trượt, rồi một
phép so sánh kiểu `review.userId !== user.id` — phép so sánh đọc dòng đã load, còn request chỉ cung
cấp việc load dòng nào.

**Cách nhận ra.** Có một `userId` (hoặc `ownerId`, `tenantId`) đi trong payload của request.
Check so sánh hai giá trị mà **cả hai** đều do người gọi cung cấp. Bỏ check đi thì không test nào đỏ,
vì mọi test đều gửi id của chính mình.

**Ranh giới.** Nó không phải `AUTHZ-1`, mã chỉ hỏi có ai đăng nhập hay không. Nó không phải `AUTHZ-4`:
`AUTHZ-3` quyết định **có từ chối không**, `AUTHZ-4` quyết định **từ chối bằng câu nào** — làm đúng
`AUTHZ-3` rồi vẫn có thể rò rỉ ở `AUTHZ-4`. Nó cũng không phải `AUTHZ-5`: `AUTHZ-3` hỏi "dòng này của
ai", `AUTHZ-5` hỏi "quan hệ này đang ở trạng thái nào".

**Tình huống nghiệp vụ hay gặp.** Sửa hoặc xoá bình luận của chính mình; huỷ đơn của chính mình; đọc
chi tiết hoá đơn; đổi thiết lập của một hồ sơ; thao tác trên bản nháp; gỡ một mục đã ghim.

## `AUTHZ-4` — từ chối kiểu nào là một quyết định

**Khi nào gặp.** "Bạn không được sửa cái này" và "cái này không tồn tại" là hai **sự thật khác nhau**,
và client thường hiển thị chúng theo hai cách khác nhau. Thông thường, mỗi trường hợp nên có một
exception riêng. Ngoại lệ nằm ở bản ghi mà người gọi **lẽ ra không thể biết là có**: ở đó, trả lời
"forbidden" chính là xác nhận bản ghi tồn tại, mà sự tồn tại mới là bí mật.

**Source phải thể hiện gì.** Một lời từ chối gộp kiểu `if (!plan || plan.userId !== user.id)`, trả
đúng một not-found cho cả "không có" lẫn "không phải của bạn", kèm một luồng e2e chứng minh kẻ đột
nhập nhận đúng câu trả lời ấy và không có gì bị ghi. Nhật ký giữ lý do thật của việc làm mềm lời từ
chối; người gọi thì không — nếu log cũng mất lý do thì lần điều tra sau không còn gì để đọc.

**Cách nhận ra.** Id của bản ghi đoán được hoặc duyệt được (tăng dần, hoặc lấy từ một nguồn
khác). Người gọi không có đường hợp lệ nào để biết bản ghi này có mặt trên hệ thống. Lặp id trong một
vòng lặp và chỉ đọc mã lỗi là đã dựng được bản đồ dữ liệu.

**Ranh giới.** Nó không phải `AUTHZ-3`, mã quyết định có từ chối hay không. **Lỗi gương** của nó là
trả "not found" cho bản ghi mà người gọi **biết chính đáng** — họ vừa thấy nó trong một danh sách hợp
lệ — vì như thế là bắt một người dùng hợp lệ đi truy một cái bug không tồn tại. Cả hai chiều đều vô
hình, nên phải **nói ra** mình đang chọn cái nào.

**Tình huống nghiệp vụ hay gặp.** Bản nháp riêng tư; kế hoạch trả góp của người khác; tin nhắn riêng;
liên kết chia sẻ chưa công khai; hồ sơ đã khoá; bản ghi thuộc tenant khác.

## `AUTHZ-5` — entitlement là một trạng thái, không phải một dòng

**Khi nào gặp.** Ghi danh, thành viên, gói đăng ký, bản dùng thử. Một dòng cho biết người này **có quan
hệ** với một sản phẩm; nó không cho biết **quan hệ nào**. Một dòng dùng thử và một dòng đã trả tiền
đều là "ghi danh", và chúng cho hai quyền khác nhau.

**Source phải thể hiện gì.** Một câu query gọi tên cột trạng thái. Bằng chứng chuẩn là một cặp
guard trên cùng một quan hệ: một cái resolve-or-create dòng dùng thử rồi luôn trả về true, cái kia đọc
cờ đã trả tiền và từ chối — chính cặp đó chứng minh dòng dữ liệu và trạng thái là hai sự thật khác
nhau. Đặt tên trạng thái trong câu query, đừng đặt trong comment.

**Cách nhận ra.** Check viết bằng `exists` hoặc `count > 0` trên bảng quan hệ. Bảng quan hệ có
cột trạng thái (`isEnrolled`, `status`, `plan`, `expiresAt`) mà câu query không nhắc tới. Có một đường
nào đó **tự tạo** dòng quan hệ (trial placeholder, resolve-or-create), nghĩa là sự tồn tại của dòng
gần như miễn phí. Đây là check dễ bị viết đúng một lần rồi copy sang chỗ khác và rơi mất đúng cái cột
phân biệt.

**Ranh giới.** Nó không phải `AUTHZ-3`, mã hỏi dòng này của ai. Nó cũng không phải `AUTHZ-6`:
`AUTHZ-5` là trạng thái của **cùng một chủ thể**, `AUTHZ-6` là **chủ thể khác nhau**.

**Tình huống nghiệp vụ hay gặp.** Nội dung trả phí; nộp bài capstone; tải chứng chỉ; tính năng của gói
cao hơn; quyền bình luận sau khi mua; hạn mức còn hiệu lực; ghế trong một tổ chức.

## `AUTHZ-6` — operator là một chủ thể khác với người dùng

**Khi nào gặp.** Người vận hành nền tảng, một service token và một người dùng sản phẩm là **ba danh
tính**. Gộp cả ba vào một guard có thể khiến quản trị viên của một khách hàng vận hành được nền tảng.

**Source phải thể hiện gì.** Hai chủ thể, hai họ guard, không chung base: operator xác thực bằng
một khoá mount trên header, người dùng xác thực bằng session token, và không bên nào với tới được bên
kia. Chủ thể quyết định cả transport: một cửa phục vụ chủ thể không-phải-người-dùng thì nói ra điều
đó, và đó là một trong số ít lý do hợp lệ để cửa ấy không phải GraphQL.

**Cách nhận ra.** Một guard nhận cả session người dùng lẫn khoá máy. Một cờ `isAdmin` trên bảng
người dùng quyết định quyền vận hành. Một endpoint vận hành nằm chung class với endpoint người dùng và
dùng chung guard ở cấp class.

**Ranh giới.** Nó không phải `AUTHZ-2`, mã chỉ hỏi có tồn tại một guard hay không; `AUTHZ-6` hỏi guard
đó phục vụ chủ thể nào, nên một cửa có thể qua mã này mà trượt mã kia.

**Tình huống nghiệp vụ hay gặp.** Trang trạng thái hạ tầng; xoay khoá; phát lại một job; webhook của
đối tác; pod tự đăng ký lúc khởi động; công cụ vận hành nội bộ; export dữ liệu toàn hệ thống.

## Tầng giữ

Mỗi mã hiện được giữ ở tầng nào. `unrepresentable` nghĩa là một union đóng hoặc branded type khiến giá
trị sai không viết ra được; `enforced` nghĩa là có lint rule trong `@canon-be` bắt
được; `documented` nghĩa là không có gì cơ học giữ nó, chỉ người đọc giữ.

| Mã | Tầng | Cái gì giữ nó |
|---|---|---|
| `AUTHZ-1` | `documented` | — |
| `AUTHZ-2` | `enforced` | `identity-needs-guard` (export `identityNeedsGuard`) |
| `AUTHZ-3` | `documented` | — |
| `AUTHZ-4` | `documented` | — |
| `AUTHZ-5` | `documented` | — |
| `AUTHZ-6` | `documented` | — |

**Một mã enforced, năm mã documented, không mã nào unrepresentable.** Khoảng trống đó chính là điểm
của bảng này, và nó không phải backlog. Một rule nhắm vào `AUTHZ-3`, `AUTHZ-4` hay `AUTHZ-5` sẽ phải
biết handler đang với tới dòng nào và sở hữu dòng đó nghĩa là gì, nên nó chỉ bắn được theo hình dạng —
mà một rule bắn theo hình dạng là rule tác giả học cách tắt đi, và như thế luật còn tệ hơn lúc chưa ai
canh. `AUTHZ-1` đã được đo và cố ý để yên: một rule từ chối `if (!user)` trong handler sẽ bắn vào phần
lớn các handler đúng trong một cây CQRS.

`AUTHZ-2` là nửa duy nhất quyết định được trong phạm vi một file: method đọc danh tính, hoặc class của
nó, có mang decorator dựng ra danh tính hay không. Không cần biết gì về dòng dữ liệu để trả lời. Mỗi
dòng `documented` là một rủi ro còn mở, và điều mà một rule sẽ phải nhìn thấy để giữ được nó — hoặc lý
do không rule nào giữ được — được ghi kèm ngay ở đó.

Tầng transport giữ `AUTHZ-2` và `AUTHZ-6`; handler giữ `AUTHZ-1`, `AUTHZ-3`, `AUTHZ-4` và `AUTHZ-5`.
Service nằm cạnh handler phải hoàn toàn không biết cả sáu mã: nó không có message, nên cửa sau sẽ mọc
bản sao luật của riêng nó.

## Điểm neo

Code thật để đối chiếu từng luật. Một luật không chỉ tay vào được thì chỉ là một đề xuất.

| Mã | Điểm neo | Nhìn cái gì |
|---|---|---|
| `AUTHZ-1` | `features/api/core/graphql/mutations/courses/submit-course-review/submit-course-review.handler.ts` · `features/api/core/graphql/mutations/installment-plans/pay-next-installment/pay-next-installment.handler.ts` | Một lời từ chối `if (!user)` ở đầu `process`, đứng trên phần validate rẻ tiền và trên cả hai query, trong những handler mà resolver đã có guard. Chính chỗ thừa đó là mã này |
| `AUTHZ-2` | `@canon-be` → `IDENTITY_PARAM_DECORATORS`, `hasGuard`, `identityNeedsGuard` · `features/api/core/graphql/mutations/courses/update-course-review/update-course-review.resolver.ts` | Ba parameter decorator mà rule đếm là cái đọc danh tính, đường leo từ method lên class của nó, và một cửa thật mang `@UseGuards(...)` đứng trên tham số đọc user |
| `AUTHZ-3` | `features/api/core/graphql/mutations/courses/delete-course-review/delete-course-review.handler.ts` | `findOne` theo id được yêu cầu, một not-found khi trượt, rồi `review.userId !== user.id` — phép so sánh đọc dòng đã load, còn request chỉ cung cấp việc load dòng nào |
| `AUTHZ-4` | `features/api/core/graphql/mutations/installment-plans/pay-next-installment/pay-next-installment.handler.ts` · `tests/e2e/installment-plan-queries.e2e-spec.ts` | `if (!plan \|\| plan.userId !== user.id)` gộp "không có" và "không phải của bạn" thành một not-found; luồng test chứng minh kẻ đột nhập nhận đúng câu đó và không có gì bị ghi |
| `AUTHZ-5` | `modules/bussiness/guards/graphql-must-enrolled.guard.ts` · `modules/bussiness/guards/graphql-enrollment.guard.ts` · `modules/bussiness/user/user.service.ts` → `checkEnrollment`, `resolveOrCreateTrialEnrollment` | Hai guard trên cùng một quan hệ: một cái resolve-or-create dòng dùng thử và luôn trả true, cái kia đọc cờ đã trả tiền và từ chối. Cặp đó là bằng chứng dòng dữ liệu và trạng thái là hai sự thật khác nhau |
| `AUTHZ-6` | `modules/bussiness/guards/admin-access.guard.ts` · `modules/bussiness/guards/graphql-admin-access.guard.ts` · `modules/integrations/keycloak/guards/keycloak-auth-graphql.guard.ts` | Hai chủ thể, hai họ guard, không chung base: operator xác thực bằng khoá mount trên header, người dùng bằng session token, và không bên nào với tới được bên kia |

Mọi mã đều đã có neo. Không mã nào còn "chưa neo được".

## Đầu vào

| Đầu vào | Bằng chứng cần có |
|---|---|
| subject | Người dùng sản phẩm, người vận hành nền tảng hay service token |
| door | Method hoặc class đọc danh tính, và cái gì dựng ra danh tính đó |
| row | Bản ghi đang được với tới, và cách nó được load |
| owner | Cột trên dòng đã load mang quyền sở hữu |
| state | Cột phân biệt trạng thái được quyền với dòng chỉ có quan hệ |
| disclosure | Người gọi có thể biết bản ghi tồn tại mà không cần ai nói cho không |

## Quy tắc

1. Cửa nào **đọc** danh tính thì cửa đó mang guard dựng ra danh tính.
2. Handler tự khai điều kiện tiên quyết của nó, không phụ thuộc cửa nào đang đứng trước.
3. Quyền sở hữu đọc từ **dòng đã load**, không bao giờ đọc từ request.
4. Từ chối phải nói rõ nó là sự thật nào trong hai, và bản ghi riêng tư thì từ chối bằng not-found.
5. Nhật ký giữ lý do thật của việc làm mềm lời từ chối; người gọi thì không.
6. Check entitlement phải gọi tên cột mang trạng thái.
7. Một guard phục vụ một chủ thể.
8. Luật phân quyền nằm trong handler, chỗ mà caller thứ hai với tới được.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ đều khép kín và nêu rõ mã nó
áp dụng vào.

- **Cửa công khai.** `AUTHZ-2` chỉ áp cho cửa **có đọc** danh tính. Cửa không đọc danh tính nào thì
  không được miễn phân quyền — nó đơn giản là không có danh tính để phân quyền, và đó là một sự thật
  khác, phải viết ra trong mô tả của chính operation.
- **Danh tính tuỳ chọn.** `AUTHZ-2` chấp nhận guard cho phép người vô danh đi qua và chỉ điền danh
  tính khi có, vì danh tính vẫn được **dựng ra** chứ không bị **giả định**. Cái bị từ chối là không có
  guard nào cả.
- **Sở hữu bằng quan hệ.** `AUTHZ-3` chấp nhận đưa chủ sở hữu vào mệnh đề `where` khi load thay vì so
  sánh sau, miễn là giá trị chủ sở hữu lấy từ danh tính đã xác thực chứ không lấy từ request. Điều bất
  biến là: bên nào của phép so sánh do người gọi điều khiển.
- **Bản ghi người gọi biết chính đáng.** `AUTHZ-4` muốn một forbidden **có tên** khi người gọi tới
  được bản ghi qua một danh sách họ được phép thấy. Làm mềm cái đó thành not-found là lỗi gương, và
  cái giá là một ticket hỗ trợ chứ không phải một bí mật.
- **Quan hệ chỉ có một trạng thái.** `AUTHZ-5` cho phép rút về check tồn tại **chỉ khi** quan hệ đó
  chỉ mang đúng một nghĩa và schema không diễn đạt được nghĩa thứ hai. Ngay khi trạng thái thứ hai
  xuất hiện, mọi check tồn tại trên quan hệ đó thành lỗi.
- **Operator đóng vai người dùng.** `AUTHZ-6` cho phép một màn hình vận hành đọc dữ liệu của một người
  dùng, miễn là nó xác thực với tư cách operator và nói rõ nó đang đọc dữ liệu của ai. Cái bị cấm là
  một guard trả lời "được" cho cả hai chủ thể.

## Đầu ra

Một khối cho mỗi file mà shape đã duyệt sinh ra.

```text
operation: <mutation | query | subscription | job | webhook>
subject: <viewer | operator | service token>
situation: <AUTHZ-1 … AUTHZ-6>
door: <the guard that establishes the identity, or none>
row: <the record loaded, and the field compared>
refusal: <forbidden | not-found, and why that one>
reason: <the business fact that excludes the adjacent code>
```

## Ví dụ đã giải

**Shape đã duyệt.** Một người dùng sản phẩm đã đăng nhập xoá bài đánh giá khoá học do chính họ viết,
qua một GraphQL mutation mà resolver của nó dispatch xuống một command handler.

File resolver:

```text
operation: mutation
subject: viewer
situation: AUTHZ-2
door: the session-token guard on the resolver method
row: none loaded at the door
refusal: not applicable at the door
reason: the method reads the authenticated user as a parameter, so the guard question is answerable inside this one file — nothing about the row is needed, which is what excludes AUTHZ-3
```

File handler, khối thứ nhất:

```text
operation: mutation
subject: viewer
situation: AUTHZ-1
door: the resolver's guard, which this handler does not rely on
row: none yet
refusal: forbidden, stated as the handler's own precondition above every other gate
reason: the check asks only whether anyone is signed in, which excludes AUTHZ-3 because no row has been loaded to compare against
```

File handler, khối thứ hai:

```text
operation: mutation
subject: viewer
situation: AUTHZ-3
door: the resolver's guard
row: the review loaded by the requested id, field userId compared with the authenticated user's id
refusal: not-found, because the requested id may name a review the caller has no legitimate way to know exists
reason: the comparison reads a field off the loaded row rather than a value carried in the request, which excludes AUTHZ-5 because the question is whose row this is, not what state a relationship is in
```

File handler, khối thứ ba:

```text
operation: mutation
subject: viewer
situation: AUTHZ-4
door: the resolver's guard
row: the review loaded by the requested id
refusal: not-found for both the missing row and the row that is not the caller's, with the real reason kept in the log
reason: the caller could not otherwise know the review exists, which excludes the named forbidden that AUTHZ-4 wants for a row reached through a listing the caller was entitled to see
```

**Shape này không nói gì, và do đó không giải quyết gì.** Nó không nêu tên class guard nào dựng ra
danh tính, nên `AUTHZ-6` — guard này thuộc chủ thể nào — còn treo cho tới khi họ guard của chủ thể
được cấp. Nó không nói người gọi có tới được bài đánh giá qua một danh sách họ được phép thấy hay
không, nên lựa chọn `AUTHZ-4` ở trên chỉ đứng vững dưới đúng đầu vào disclosure được ghi kèm. Nó không
nhắc gì tới quan hệ đã trả tiền, nên `AUTHZ-5` hoàn toàn không phát sinh ở đây.

## Phạm vi

Luật này đúng với mọi back end xác thực ở biên transport và quyết định phân quyền bên trong handler.
Nó không gọi tên một tính năng nào: ví dụ đều là TypeScript thường trong một ứng dụng hình dạng
NestJS, không nêu sản phẩm nào, repository nào hay khoá học nào. Id của rule và tên các decorator mà
rule khớp là những danh từ riêng duy nhất, vì đó là danh tính thực thi và một rule bị đổi tên thì
không trích dẫn được trong config.
