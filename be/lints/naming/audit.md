---
id: be-lints-naming-audit
title: audit.md
slug: /be/lints/naming/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện xem phần cưỡng chế của luật đặt tên có trung thực với chính nó không.
---

# audit.md

> Version: `2.00` · Mô-đun: `naming`

Phản biện này không hỏi "luật đặt tên có đúng không". Nó hỏi một câu hẹp hơn và khó chịu hơn: **bảng
cưỡng chế này có nói đúng những gì máy thật sự nhìn thấy không**, và có nói đủ những gì máy **không**
nhìn thấy không.

## Verdict

Chấp nhận, với **năm phát hiện** và **mười bốn rủi ro còn mở** được ghi tên, đi ra từ 22 dòng cửa mở
trong bảng cưỡng chế.

Số quy tắc đếm được trong nguồn là **đúng hai**: `no-version-in-name` và `no-bare-verb-export`, cả
hai nằm trong export `rules`. Con số này khớp với con số dự kiến. Không có quy tắc thứ ba nào đang
sống trong tệp; quy tắc thứ ba từng tồn tại và đã bị xoá, và phần chú thích đầu tệp giữ lại lý do —
xem `Findings`.

Điều làm mô-đun này khác các mô-đun cưỡng chế khác: **tỷ lệ luật được máy giữ ở đây thấp nhất trong
cả kệ, và đó là kết quả đúng.** Bảy điều luật, hai quy tắc. Nguồn không cố lấp chỗ trống, và nó nêu
lý do bằng một phép đo chứ không bằng một ý kiến. Một bảng cưỡng chế trung thực với hai dòng đáng tin
hơn một bảng bảy dòng có năm dòng đoán.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| Số quy tắc trong nguồn so với số dự kiến | Bằng nhau: **2**. Cả hai đều có `meta`, `messages` và `create`, và cả hai đều nằm trong `rules` |
| Mỗi quy tắc có đúng một mã luật | Đạt. `no-version-in-name` → `NAME-2`; `no-bare-verb-export` → `NAME-5` |
| Băng-rôn mã luật trong nguồn có khớp luật không | **Đạt.** Hai dải phân cách trong nguồn ghi `NAME-2` và `NAME-5`, và cả hai khớp với nội dung điều luật tương ứng. Đây không phải chuyện hiển nhiên; ở một mô-đun khác cùng kệ, băng-rôn đã ghi sai mã |
| Có mã luật nào bị hai quy tắc cùng giữ không | Không |
| Có quy tắc nào không giữ mã nào không | Không |
| Mỗi thông điệp có phân biệt được tình huống không | Đạt, nhưng mỗi quy tắc chỉ có **một** thông điệp, nên thông điệp không phân biệt gì thêm ngoài chính quy tắc |
| Quy tắc có đọc tên tệp không | **Không**, cả hai. Không có miễn trừ theo thư mục, và cũng không có phán xét nào về tên tệp |
| Quy tắc có nhận tuỳ chọn không | Không, cả hai đều `schema: []` |
| Quy tắc có sửa mã tự động không | Không, cả hai đều không có `fixable` và không có fixer |
| Mức nghiêm trọng khi xuất xưởng | **`warn`, cả hai.** Không quy tắc nào ở mô-đun này chặn được một commit |

## Findings

**1. Năm trong bảy điều luật không có quy tắc, và đó là chủ ý được ghi lại.**
`NAME-1`, `NAME-3`, `NAME-4`, `NAME-6`, `NAME-7` do người review giữ. Nguồn nói thẳng: biết một cái
tên đang mô tả một thư mục, một cơ chế hay người gọi đầu tiên thì phải biết **thứ đó là gì** —
`VolumeService` đọc lên hoàn hảo cho tới lúc ta biết thư mục đã đổi tên, và không bộ phân tích cú
pháp nào biết chuyện đó. Đây là phát hiện đáng ghi vì nó là **hình mẫu**, không phải thiếu sót: một
điều luật không có quy tắc thì được biết là không được cưỡng chế, và người đọc bù vào. Một quy tắc
được tin là kín mà thật ra thủng thì tệ hơn.

**2. `NAME-1` từng có quy tắc, đã được đo, và đã bị xoá — phần xoá mới là phần đáng đọc.**
Bản đầu đòi tên tệp phải đánh vần ra cả tên lớp mà nó khai báo, và đo được **616 vi phạm trên 4430
tệp**. Nhưng quy ước thực tế ngược lại: **đường dẫn** mang vai trò và phạm vi, **tệp** chỉ gọi tên
chủ thể. Mười bốn phần trăm một cây mã không phải là nợ, nó là quy ước. Quy tắc bị xoá là quyết định
đúng, và mô-đun này ghi lại nó vì một lý do rất cụ thể: đây là bằng chứng duy nhất trong kệ cho thấy
một quy tắc **có thể chạy được** vẫn bị từ chối khi phép đo nói rằng nó đang cãi lại mã nguồn.

**3. `NAME-6` trông như được giữ một nửa, và thật ra không được giữ.**
Điều luật cấm đặt tên biến luận lý là `checkX`. Từ `check` **có** trong tập động từ trơ, nên
`export const check = …` bị báo — nhưng bị báo bởi `no-bare-verb-export`, dưới `NAME-5`, và vì một lý
do hoàn toàn khác (động từ không có tân ngữ). Đúng hình dạng mà `NAME-6` cấm — `checkVerified`,
`checkOwnership` — thì tra thành viên trượt, và không có gì bắn ra. Đây là loại nhầm nguy hiểm nhất
mà kệ này tồn tại để chặn: một mã luật có vẻ đã có người giữ.

**4. Cả hai quy tắc xuất xưởng ở `warn`, và mô-đun phải nói câu đó ra to.**
Ở mọi mô-đun khác trên kệ, "cổng xanh" gần với "quy tắc không tìm thấy gì". Ở đây thì không: một
repo có thể có hàng trăm cảnh báo của cả hai quy tắc và vẫn xanh mọi cổng. Nguồn giải thích rõ vì sao
— luật đặt tên rơi xuống cây mã trưởng thành có nợ thật, và bật `error` ngày đầu sẽ chặn mọi commit
chạm vào tệp cũ, dạy người ta cách tắt quy tắc. Lý do đúng; hệ quả vẫn phải được ghi, vì nó đổi ý
nghĩa của chữ "đạt".

**5. Nửa biểu thức chính quy gần như không bao giờ chạy được.**
Nhánh `_V[0-9]+` được viết cho tên kiểu hằng số viết hoa (`SCHEMA_V2`, `MY_V2_FLAG`). Nhưng tập
visitor không chạm tới hằng số, thuộc tính, hay thành viên enum — nó chỉ chạm tới tên hàm, lớp,
interface, type alias và phương thức, mà những loại tên đó gần như không bao giờ dùng dấu gạch dưới.
Nhánh thứ hai của biểu thức là mã gần chết. Không có hại, nhưng nó làm biểu thức **trông** phủ rộng
hơn thực tế, và đó là chính xác loại ảo giác kệ này phải phá.

## Decisions

- **Giữ đúng hai quy tắc trong bảng.** Không thêm dòng nào cho một quy tắc "nên có". Luật cao nhất
  của canon: một quy tắc không chỉ tay vào được là một đề xuất, không phải một quy tắc.
- **Lấy luật làm chuẩn khi ánh xạ mã, không lấy băng-rôn trong nguồn.** Lần này hai bên khớp nhau,
  nên quyết định không phải trả giá — nhưng thứ tự ưu tiên vẫn được ghi ra để lần sau không phải bàn.
- **Ghi mức `warn` vào bảng `Rules`, không giấu xuống dưới.** Mức nghiêm trọng là khác biệt giữa một
  báo cáo và một cổng chặn, nên nó thuộc về câu đầu tiên chứ không phải chú thích cuối trang.
- **Coi mọi cửa còn mở là khe hở của quy tắc, không bao giờ là quyền của luật.** Mọi đoạn mã trong
  mục "Cửa lách" của `example.md` đều được dán nhãn là **vi phạm luật mà máy không thấy**, không phải
  cách viết được phép.
- **Tên quy tắc chép nguyên văn.** Tên là danh tính: đó là chuỗi in ra trong log build, trong dòng
  tắt cảnh báo và trong mọi cuộc trao đổi. Lệnh cấm tên sản phẩm áp cho lời văn và ví dụ, không áp
  cho một định danh đã xuất xưởng.
- **Không đề xuất mở rộng tập động từ trong tài liệu này.** Danh sách mười tám từ là một quyết định
  của nguồn; thêm từ là thay đổi quy tắc, và thay đổi quy tắc đi qua nguồn chứ không qua trang này.

## Rủi ro còn mở

Mỗi mục dưới đây là một cách viết **sai luật mà máy không thấy**, kèm câu trả lời cho câu hỏi: quy
tắc phải nhìn thêm cái gì để đóng nó lại, và giá của việc đóng có đáng không.

**Của `no-version-in-name`**

1. **Khai báo biến không được thăm** — `export const parseV2Body = () => {}`.
   *Đóng bằng cách nào:* thêm visitor `VariableDeclarator` với `id.type === "Identifier"`. Rẻ, an
   toàn, và quy tắc anh em trong cùng tệp đã làm đúng việc đó. Đây là khe hở duy nhất trong danh sách
   mà **giá đóng gần bằng không** và lợi ích rõ ràng. Đáng làm.
2. **Trường của interface và của lớp** — `{ isV2: boolean }`, `readonly isV2 = true`.
   *Đóng bằng cách nào:* thêm `TSPropertySignature` và `PropertyDefinition`. Cũng rẻ. Rủi ro là số
   phát hiện sẽ nhảy vọt trên cây mã cũ, nên phải đo trước — đúng thứ tự mà nguồn đã dặn.
3. **Thành viên trừu tượng** — `abstract parseV2Body()`.
   *Đóng bằng cách nào:* thêm `TSAbstractMethodDefinition`. Một dòng.
4. **Từ viết tắt đứng liền trước phiên bản** — `ContentAPIV2Parser`.
   *Đóng bằng cách nào:* bỏ ràng buộc `[a-z]` trước chữ `V`. Giá: `ContentV2` vẫn bắt được, nhưng bất
   kỳ tên nào có một chữ `V` hoa đi liền số vì lý do khác cũng bắt theo. Cần đo trên cây thật trước
   khi nới, vì một quy tắc bắn vào mã đúng còn tệ hơn không có quy tắc — người sau học được thói quen
   cuộn qua nó.
5. **Chữ thường ngay sau dãy số** — `parseV2body`.
   *Đóng bằng cách nào:* bỏ ràng buộc `(?:$|[A-Z_])`. Cùng loại đánh đổi như trên, và rủi ro bắt nhầm
   cao hơn: một cái tên chứa `v` hoa và số ở giữa từ sẽ dính.
6. **Chỉ biết một cách đánh vần phiên bản** — `Schema2`, `Rev2`, `Gen2`, `Legacy`, `Old`, `Next`.
   *Đóng bằng cách nào:* không đóng được bằng cú pháp. `Legacy` chỉ sai khi ta biết cái mới là gì, và
   đó là điều nguồn đã nói về `NAME-3` và `NAME-4`. Để cho người review, có ý thức.
7. **Chữ `V` viết thường** — `parse_v2`, `isv2`.
   *Đóng bằng cách nào:* thêm cờ không phân biệt hoa thường. **Không nên**: `\bv[0-9]` không phân biệt
   hoa thường sẽ bắt cả những từ bình thường có `v` cộng số. Giá cao hơn lợi.
8. **Tên tệp hoàn toàn vô hình** — `content-v2.service.ts`.
   *Đóng bằng cách nào:* đọc `context.filename`. Đây là cửa ngõ sang `NAME-1`, và cần xử lý riêng —
   xem mục 13.

**Của `no-bare-verb-export`**

9. **Danh sách specifier và tái xuất bản** — `export { generate }`, `export { x as generate }`,
   `export * from`.
   *Đóng bằng cách nào:* đọc `node.specifiers` khi `node.declaration` vắng mặt, và so `exported.name`
   thay vì `local.name`. Rẻ, và nó đóng khe hở **lớn nhất** của quy tắc: kiểu "khai báo trên, export
   dưới" là thao tác dọn dẹp vô hại nhất có thể tưởng tượng và nó tắt cả quy tắc.
   `ExportAllDeclaration` thì không đóng được nếu không phân giải mô-đun.
10. **Export mặc định** — `export default function generate()`.
    *Đóng bằng cách nào:* thêm visitor `ExportDefaultDeclaration`. Rẻ. Cần bàn xem tác hại có giống
    nhau không: export mặc định không mang tên sang chỗ nhập, nên lập luận "va chạm ở danh sách
    import" yếu đi — nhưng lập luận "cái tên không nói gì" thì không đổi.
11. **Hàm bị bọc** — `export const generate = memoize(fn)`.
    *Đóng bằng cách nào:* chỉ kiểm tên, bỏ hẳn điều kiện `init` là biểu thức hàm. Giá: quy tắc sẽ bắt
    cả một hằng số dữ liệu tình cờ tên `set` hay `get`. Có thể chấp nhận được, nhưng phải đo.
12. **Danh sách mười tám từ là đóng** — `execute`, `emit`, `validate`, `render`, `find`, `save`, `list`.
    *Đóng bằng cách nào:* không có cách đóng "đúng". Mọi danh sách viết tay đều đóng ở đâu đó, và một
    danh sách dài hơn chỉ dời chỗ thủng chứ không bịt nó. Cách duy nhất tổng quát là đảo ngược phép
    thử — đòi mọi export hàm phải có **từ thứ hai** — và đó là một quy tắc khác hẳn, với một tỷ lệ
    bắt nhầm khác hẳn. Đây là đề xuất thay đổi luật, không phải một lần vá.
13. **Không quy tắc nào giữ nửa còn cưỡng chế được của `NAME-1`.**
    Bản bị xoá đòi tên tệp đánh vần cả tên lớp, và phép đo đã bác nó. Nhưng điều luật **còn** một nửa
    mà máy giữ được và không ai đang giữ: **hậu tố tệp phải khớp vai trò của thứ nó export.** Một tệp
    `*.service.ts` phải export một `*Service`; một tệp `*.handler.ts` phải export một `*Handler`. Đây
    là so hậu tố với hậu tố, không phải so cả tên, nên nó **không** đụng vào quy ước "đường dẫn mang
    vai trò, tệp gọi tên chủ thể" đã làm bản trước sai. *Giá:* phải đọc `context.filename` và duyệt
    các export cấp cao nhất. *Rủi ro:* tệp có nhiều export, tệp `index.ts`, tệp không export lớp nào.
    Đây là ứng viên quy tắc thứ ba mạnh nhất, và nó vẫn chỉ là **đề xuất** cho tới khi có người đo nó
    trên một cây thật.
14. **Không có gì cưỡng chế mức nghiêm trọng.**
    Cả hai quy tắc ở `warn`. Không có sổ nợ nào trong nguồn ràng buộc chúng phải lên `error` vào một
    thời điểm, nên trạng thái mặc định là "cảnh báo mãi mãi", và cảnh báo mãi mãi là cảnh báo bị cuộn
    qua. *Đóng bằng cách nào:* một mục nợ có số đo và có ngày, đúng cách mà mô-đun ngoại lệ trên cùng
    kệ đã làm trước khi lật hai quy tắc của nó lên `error`.

## Re-audit Triggers

- Nguồn thêm, xoá hoặc đổi tên một quy tắc — kể cả khi lời văn của luật không đổi.
- Mức trong `recommended` đổi từ `warn` sang `error`, hoặc ngược lại.
- Tập mười tám động từ trơ được thêm hoặc bớt một từ.
- Biểu thức chính quy phiên bản được nới hoặc siết một nhánh.
- Một visitor mới được thêm vào `no-version-in-name`, đặc biệt là `VariableDeclarator` — đó là khe hở
  rẻ nhất trong danh sách và là thứ nhiều khả năng đổi trước nhất.
- Có ai đó đề xuất lại một quy tắc dựa trên tên tệp: phải đọc lại phép đo 616/4430 **trước** khi bàn.
- Một quy tắc ở mô-đun này bị tắt bằng dòng chú thích ở hơn một chỗ trong cùng một tuần — đó là dấu
  hiệu quy tắc đang bắn vào mã đúng, không phải dấu hiệu người viết ẩu.
- Một mã luật đang không có quy tắc bỗng được ai đó mô tả là "đã có lint giữ" trong review.
