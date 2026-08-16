---
id: be-patterns-authorization-audit
title: audit.md
slug: /be/patterns/authorization/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định, mức thi hành và khả năng neo của luật Authorization.
---

# audit.md

> Version: `2.00` · Module: `authorization`

Audit này kiểm ba thứ: luật có chọn được **một** mã từ dữ kiện nghiệp vụ đã nêu; bảng `Tầng giữ` có
nói thật về chỗ nào có máy giữ và chỗ nào không; và mỗi mã có chỉ được vào code thật hay không.

## Verdict

Chấp nhận. Sáu mã giữ nguyên số và nguyên nghĩa, một mã có lint rule, năm mã chỉ có người đọc, và cả
sáu đều neo được vào code đang chạy.

Phần đáng phản biện nhất của module này **không** phải nội dung luật — nội dung đã ổn định từ bản
phẳng. Nó là khoảng cách 1/6 giữa thi hành và tài liệu, và audit này kết luận khoảng cách ấy là **cố
ý và đúng**, chứ không phải một backlog chưa làm.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `AUTHZ-1` vs `AUTHZ-2` | Loại trừ được: một bên là chỗ danh tính được **dựng ra**, bên kia là chỗ nó được **dùng** |
| `AUTHZ-1` vs `AUTHZ-3` | Loại trừ được: "có ai không" không cần dòng dữ liệu, "có phải người này không" thì cần |
| `AUTHZ-2` vs `AUTHZ-6` | Loại trừ được: **không có** guard khác với **sai** guard cho chủ thể |
| `AUTHZ-3` vs `AUTHZ-4` | Loại trừ được: quyết định **có từ chối** tách khỏi quyết định **từ chối bằng câu nào** |
| `AUTHZ-3` vs `AUTHZ-5` | Loại trừ được: chủ sở hữu của một dòng khác với trạng thái của một quan hệ |
| `AUTHZ-5` vs `AUTHZ-6` | Loại trừ được: cùng chủ thể ở trạng thái khác, khác hẳn với hai chủ thể |
| Thiếu dữ kiện về mức lộ | Hỏi đúng một câu: người gọi có đường hợp lệ nào để biết bản ghi tồn tại không |

## Findings

- **Sáu mã, một rule.** Bản phẳng đã nói rõ điều này và module chỉ dựng nó thành bảng: `AUTHZ-2` là
  nửa duy nhất trả lời được trong phạm vi một file. Bảng `Tầng giữ` làm cho khoảng cách ấy **đọc được**
  thay vì phải suy ra từ một đoạn văn.
- **Cả sáu mã đều neo được.** Không mã nào phải ghi `chưa neo được`. `AUTHZ-5` neo vào một **cặp**
  guard trên cùng một quan hệ — một guard tạo dòng dùng thử và luôn cho qua, một guard đọc cột đã trả
  tiền — và cặp đó là bằng chứng mạnh hơn bất kỳ câu văn nào rằng dòng và trạng thái là hai sự thật.
- **`AUTHZ-3` không lint được vì lý do cấu trúc, không phải vì thiếu công.** Hai câu query đúng và sai
  có **cùng AST shape**; khác biệt duy nhất là giá trị chủ sở hữu đến từ danh tính hay từ request. Đó
  là câu hỏi data-flow xuyên biên giới transport, không phải câu hỏi cú pháp.
- **Rule của `AUTHZ-2` khớp theo một danh sách tên decorator cứng.** Ba tên, viết thẳng trong file
  rule. Thêm một decorator đọc danh tính thứ tư mà quên thêm vào danh sách thì rule **im lặng** đúng
  kiểu im lặng mà chính nó sinh ra để bắt.
- **`AUTHZ-4` gánh hai lỗi ngược chiều nhau.** Một mã, hai hướng hỏng: rò rỉ sự tồn tại, và làm mềm
  chỗ không cần mềm. Cả hai đều vô hình khi đọc code, nên gộp là hợp lý — nhưng phải nói rõ, và luật
  đã nói rõ.
- **Không mã nào ở tầng `unrepresentable`.** Phân quyền là quan hệ giữa một danh tính và một dòng dữ
  liệu tại runtime; không union đóng hay branded type nào làm cho một handler quên load dòng trở thành
  không viết được.

## Decisions

- Giữ đúng sáu mã: `AUTHZ-1`, `AUTHZ-2`, `AUTHZ-3`, `AUTHZ-4`, `AUTHZ-5`, `AUTHZ-6`. Số và nghĩa
  không đổi so với bản phẳng.
- Giữ `AUTHZ-2` là mã duy nhất `enforced`, và **không** thêm rule cho các mã còn lại chỉ để cho bảng
  đẹp. Rule bắn theo hình dạng là rule người ta học cách tắt, và tắt xong thì luật còn tệ hơn lúc chưa
  ai giữ.
- Ghi rõ trong `INDEX.md` rằng `AUTHZ-1` đã được **đo và cố ý bỏ qua**, để người đọc sau không "làm
  nốt cho xong" bằng một rule bắn vào phần lớn handler đúng trong cây.
- Giữ mọi ví dụ ở dạng TypeScript NestJS tổng quát, không tên sản phẩm; chỉ bảng `Anchor` mang đường
  dẫn thật, vì đó đúng là việc của bảng ấy.
- Giữ tên decorator `CurrentUser` trong ví dụ vì đó là **danh tính thi hành** của rule.

## Rủi ro còn mở

Mỗi mã chỉ ở tầng `documented` được nêu lại ở đây, kèm điều một lint rule **sẽ phải nhìn thấy** để giữ
được nó — hoặc lý do không rule nào giữ được.

- **`AUTHZ-1` — handler tự sở hữu điều kiện tiên quyết.** Một rule sẽ phải thấy: handler này có nhận
  danh tính trong params không, và có refusal nào đọc danh tính đó trước lần chạm dữ liệu đầu tiên
  không. Viết được về mặt kỹ thuật. **Cố ý không viết**, vì hình dạng "handler có `if (!user)`" là
  hình dạng của phần lớn handler ĐÚNG trong cây — một rule bắn vào đó là một cổng chống lại canon chứ
  không phải giữ canon. Mã này sống bằng review, và bằng việc bảng `Anchor` chỉ thẳng vào hai handler
  làm đúng.
- **`AUTHZ-3` — sở hữu quyết định trên dòng đã load.** Một rule sẽ phải theo được **nguồn** của giá
  trị đem so sánh: nó chảy ra từ tham số danh tính đã xác thực, hay từ payload request. Đây là phân
  tích luồng dữ liệu liên thủ tục xuyên qua một command object, không phải một câu hỏi trong phạm vi
  file. Với type checker hiện tại, hai đoạn code đúng và sai của mã này không phân biệt được.
- **`AUTHZ-4` — kiểu từ chối.** Một rule sẽ phải biết bản ghi này **riêng tư hay công khai với người
  gọi** — nghĩa là biết người gọi có đường hợp lệ nào tới nó không. Đó là dữ kiện sản phẩm, không nằm
  trong bất kỳ file nguồn nào. Cách gần nhất mà máy giúp được: bắt buộc mỗi exception từ chối phải khai
  một trường "đây là forbidden hay not-found, và vì sao", rồi lint sự **vắng mặt** của trường đó. Đó
  là một rule về siêu dữ liệu của exception, thuộc `exception-identity.md`, không thuộc module này —
  và nó chưa tồn tại.
- **`AUTHZ-5` — entitlement là trạng thái.** Một rule sẽ phải biết bảng quan hệ nào **có** cột trạng
  thái, rồi bắt mọi câu query trên bảng đó phải nhắc tới cột ấy. Đây là mã có cơ hội cơ học **cao
  nhất** trong năm mã còn lại: danh sách bảng-có-trạng-thái là hữu hạn và khai báo được. Cái chặn lại
  là câu query có thể dựng động (query builder, repository generic, raw SQL), nên một rule chỉ đọc
  literal object sẽ giữ được phần dễ và bỏ lọt phần khó — và phần khó chính là chỗ lỗi hay nằm. Nếu
  sau này có rule, nó phải nói rõ nó chỉ phủ dạng literal.
- **`AUTHZ-6` — một guard một chủ thể.** Một rule sẽ phải biết **mỗi guard phục vụ chủ thể nào**. Không
  có gì trong mã nguồn nói ra điều đó hôm nay; tên class là quy ước, không phải khai báo. Nếu mỗi guard
  khai chủ thể của nó bằng metadata (một decorator, một field tĩnh), thì rule trở nên tầm thường: cửa
  nào mang hai guard khác chủ thể, hoặc cửa vận hành mang guard chủ thể người dùng, là lỗi. Việc phải
  làm trước không phải viết rule, mà là làm cho chủ thể **khai báo được**.

Hai rủi ro nữa không thuộc mã nào:

- **Danh sách decorator cứng của rule `AUTHZ-2`.** Rule chỉ biết ba tên. Một decorator đọc danh tính
  thứ tư ra đời mà không được thêm vào danh sách thì cửa dùng nó vô hình với cổng. Đây là điểm bảo trì
  thật, và nó nên được kiểm bằng một phép đối chiếu định kỳ giữa danh sách trong rule và các decorator
  tham số thực sự đọc `request.user` trong cây.
- **`AUTHZ-4` gộp hai lỗi ngược chiều.** Nếu thực tế cho thấy hai chiều cần tách thành hai mã, đó là
  một đề xuất **rule change** ghi vào `changelog.md`, không phải một lần chọn khác đi. Module này giữ
  nguyên sáu mã như bản phẳng đã đặt.

## Re-audit Triggers

- Có thêm một decorator tham số đọc danh tính mà chưa nằm trong danh sách của rule `AUTHZ-2`.
- Một bảng quan hệ mọc thêm cột trạng thái, khiến mọi check tồn tại cũ trên bảng đó thành lỗi.
- Có đề xuất thêm, bớt hoặc đánh lại số một mã `AUTHZ-<n>`.
- Một guard mới phục vụ nhiều hơn một chủ thể, hoặc một cờ trên bảng người dùng bắt đầu quyết định
  quyền vận hành.
- Một handler bị gỡ mất điều kiện tiên quyết danh tính trong một lần "dọn code".
- Một anchor trong bảng `Anchor` bị đổi tên, chuyển chỗ hoặc xoá.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
