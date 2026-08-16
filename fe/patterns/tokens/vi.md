---
id: fe-patterns-tokens-vi
title: vi.md
slug: /fe/patterns/tokens/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống TOKEN-N, nhận diện bằng nghiệp vụ và bằng tầng file chứ không bằng mắt.
---

# vi.md

> Version: `2.00` · Module: `tokens`

# Tokens

Token là **thành viên của một tập đóng**. Không phải một giá trị mà mọi người đồng ý là nên dùng — mà
là giá trị duy nhất có thể **gõ ra được**. Một màn hình lệch thang không phải màn hình trượt review;
nó là màn hình **không biên dịch được**.

Vì thế phần lớn luật này do **type** giữ, và phần còn lại tồn tại để phủ đúng những chỗ type với
không tới. Toàn bộ hình dạng module nằm ở chỗ chia đó:

> **Union bảo vệ cái bảng, và rule bảo vệ cái thư mục mà union không nhìn thấy.**

**Đây là luật bắt buộc.** Mọi số đo, mọi màu và mọi chiều cao control mà một màn hình phát ra đều rơi
vào đúng một mã dưới đây. Không có giá trị nào nhỏ đến mức được miễn. Câu "có mỗi một class thôi mà"
chính là chỗ giá trị lệch thang cuối cùng của một codebase thật đã sống sót qua mọi rule đang có.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Tầng giữ |
|---|---|---|
| `TOKEN-1` | Cần một giá trị layout không có trong bảng từ vựng | `unrepresentable` |
| `TOKEN-2` | Cần **thêm** một giá trị vào bảng từ vựng | `documented` |
| `TOKEN-3` | Xuất hiện nửa bậc: `gap-1.5`, `py-1.5`, `size-3.5` | `enforced` — `no-fractional-step` |
| `TOKEN-4` | Xuất hiện `[13px]` hoặc một mã màu thô | `enforced` — `no-arbitrary-value` |
| `TOKEN-5` | Chữ to cộng chữ đậm được ghép tay thành một tiêu đề | `enforced` — `no-hand-rolled-heading` |
| `TOKEN-6` | Class được viết trong leaf, hoặc bị nhấc lên hằng số module | `documented` |
| `TOKEN-7` | Cần màu ngữ nghĩa: dấu trần, nền mềm, hay nền đặc | `documented` |
| `TOKEN-8` | Chọn chiều cao cho một nút | `documented` |
| `TOKEN-9` | Class gọi tên một token mà theme chưa định nghĩa | `enforced` — `no-unresolved-token-class` |

---

## `TOKEN-1` — thang là một union, nên giá trị lệch thang không gõ ra được

**Tình huống.** Ai đó cần một khoảng cách mà bảng từ vựng không có, và phản xạ đầu tiên là viết đại
`gap-[13px]` rồi đi tiếp.

**Dấu hiệu nhận biết**

- Giá trị nằm trong một entry đã được gõ kiểu, chứ không nằm trong leaf.
- Trình biên dịch đã đỏ trước khi có ai kịp mở review.
- Không có rule nào phải nói gì về chuyện này cả.

**Tự hỏi.** `gap-[13px]` bị **cấm**, hay nó **không phải thành viên**? Nếu là vế sau — đây là
`TOKEN-1`, và không có gì để tranh luận.

**Ranh giới**

- ↔ `TOKEN-4`: cùng nói về `[13px]`, nhưng khác chỗ đứng. Trong entry đã gõ kiểu thì compiler từ
  chối, đó là `TOKEN-1`. Trong leaf — nơi union không với tới — thì rule bắt, đó là `TOKEN-4`.
- ↔ `TOKEN-2`: `TOKEN-1` nói **không gõ được**; `TOKEN-2` nói **muốn gõ được thì phải làm gì**.

**Vì sao union thay được cả một họ rule.** Không còn gì để tuần tra khi giá trị sai không gõ ra được,
và không còn gì để tranh cãi khi compiler đã từ chối trước.

**Tình huống nghiệp vụ hay gặp.** Dựng entry cho một card mới · port một màn hình cũ sang tầng entry ·
sửa một seam bị chê chật · nhận một đóng góp từ người mới vào repo.

---

## `TOKEN-2` — thêm thành viên là **sửa thang**, và phải đọc ra là như vậy

**Tình huống.** Bảng từ vựng thật sự thiếu một thứ. Việc đúng không phải là né union, mà là **mở nó
ra một cách có chủ ý**, trong danh sách có tên, ở chỗ mà diff nhìn thấy.

**Dấu hiệu nhận biết**

- Nhu cầu lặp lại ở nhiều màn hình, không phải một chỗ.
- Người thêm nói được **quan hệ** mà bậc mới đặt tên, không chỉ nói được số đo.
- Thay đổi nằm trong danh sách từ vựng, không nằm trong một component.

**Tự hỏi.** Đây là một quyết định về **nhịp của cả nhà**, hay là một lần chữa cháy cho **một** màn
hình? Nếu là vế sau, câu trả lời là bậc gần nhất chứ không phải thành viên mới.

**Ranh giới**

- ↔ `TOKEN-1`: xem trên.
- ↔ `TOKEN-3`: một bậc rưỡi **không bao giờ** là ứng viên thành viên mới. Thang là các bậc nguyên,
  cách nhau không đều, nên nửa bậc không nằm giữa hai bậc — nó nằm ngoài thang.

**Đây là mã không ai giữ hộ.** Union từ chối được **người ngoài**, nhưng không phán được rằng một
thành viên **mới** đã được cân nhắc hay chỉ là chép vào cho xong.

**Tình huống nghiệp vụ hay gặp.** Thêm một breakpoint container · thêm một inset cho một loại surface
mới · nhận về một union song song do repo khác tự mọc ra và phải gộp lại.

---

## `TOKEN-3` — nửa bậc không nằm giữa hai bậc, nó nằm ngoài thang

**Tình huống.** Một giá trị dạng `x.5` xuất hiện ở bất kỳ họ nào có đo đạc: `gap`, `p`, `m`,
`space`, `size`, `w`, `h`, `inset` và các cạnh của chúng.

**Dấu hiệu nhận biết**

- Giá trị có dấu chấm thập phân.
- Nó được biện minh bằng "cái kia hơi chật một tí".
- Tìm cả sản phẩm không ra chỗ thứ hai dùng đúng giá trị đó.

**Tự hỏi.** Có tồn tại một trường hợp nào mà đáp án đúng là **một nửa** của một bậc không? Không có.
Đây là mã **chính xác**, không phải mã thẩm mỹ.

**Ranh giới**

- ↔ `TOKEN-4`: `size-3.5` là nửa bậc (`TOKEN-3`); `size-[14px]` là giá trị tuỳ ý (`TOKEN-4`). Chúng
  vẽ ra cùng một thứ và hỏng theo hai kiểu khác nhau, nên chúng là hai mã.
- ↔ `TOKEN-2`: nửa bậc không phải đề xuất thành viên mới. Xem trên.

**Tình huống nghiệp vụ hay gặp.** Căn một glyph cho vừa một dòng chữ · nhích một badge cho khỏi đè ·
thu một control cho lọt vào một row chật · port một số đo lẻ từ ảnh thiết kế.

---

## `TOKEN-4` — giá trị tuỳ ý thoát khỏi hệ thống, dù nó bằng bao nhiêu

**Tình huống.** Một độ dài trong ngoặc vuông, hoặc một mã màu thô. Được chọn **một lần**, bởi **một
người**, cho **một** màn hình.

**Dấu hiệu nhận biết**

- `[...]` trong một class đo đạc, hoặc `#` trong một class màu.
- Nó có thể đang **đúng bằng** một bậc — và đó chính là cái bẫy.
- Không ai tìm ra nó khi tra thang, và nó **không di chuyển** khi thang di chuyển.

**Tự hỏi.** Ngày mai thang đổi, giá trị này có đổi theo không? Nếu không, nó đã đứng ngoài hệ thống
rồi, bất kể hôm nay nó trông có đúng hay không.

**Ranh giới**

- ↔ `TOKEN-1`: xem trên — cùng một hình dạng giá trị, khác tầng file, khác thứ giữ nó.
- ↔ `TOKEN-7`: `text-[#16a34a]` là màu thô (`TOKEN-4`). `text-success-soft` dùng cho một dấu trần là
  **màu ngữ nghĩa dùng sai vai** (`TOKEN-7`). Một cái đứng ngoài bảng màu, cái kia đứng trong bảng
  màu nhưng sai vai trò.
- ↔ `TOKEN-9`: `max-w-[64rem]` là `TOKEN-4`. `max-w-app-lg` khi theme chưa có biến là `TOKEN-9`. Cả
  hai đều hỏng, nhưng chỉ một cái **trông như** đang đúng.

**Tình huống nghiệp vụ hay gặp.** Khớp một màu thương hiệu lấy từ file thiết kế · ghim một chiều rộng
sidebar · chỉnh một shadow cho "giống bản mẫu" · vá gấp một chỗ tràn chữ.

---

## `TOKEN-5` — thứ bậc đến từ thang chữ, không đến từ tổ hợp ghép tay

**Tình huống.** Chữ to cộng chữ đậm. Đó **là** một heading, dù nó nằm trên thẻ gì.

**Dấu hiệu nhận biết**

- Một `span` hoặc `div` mang cả class cỡ lớn lẫn class đậm.
- Đọc bằng mắt thì nó là tiêu đề; đọc bằng outline thì nó không tồn tại.
- Ngày thang chữ đổi, chỗ này **ở lại phía sau**.

**Tự hỏi.** Outline mà một screen reader dựng lên có chứa dòng này không? Nếu nó trông như tiêu đề mà
outline không có nó, đó là `TOKEN-5`.

**Ranh giới**

- ↔ `TOKEN-4`: `TOKEN-5` không nói gì về việc giá trị có trong thang hay không. `text-2xl` và
  `font-bold` **đều** là thành viên hợp lệ; cái sai là **ghép chúng lại ở đây**.
- ↔ `TOKEN-1`: union không cứu được mã này, vì cả hai class đều là thành viên.

**Vì sao đây là mã về ngữ nghĩa chứ không phải về kiểu dáng.** Thứ bị mất không phải cỡ chữ — nó là
**cấu trúc tài liệu**, và cấu trúc thì không nhìn thấy trên ảnh chụp màn hình.

**Tình huống nghiệp vụ hay gặp.** Tiêu đề trong một empty state · số liệu lớn trên một thẻ thống kê ·
tên khoá học trên một card · tiêu đề bên trong một modal · tiêu đề của một section mới thêm gấp.

---

## `TOKEN-6` — rule tồn tại vì cái thư mục union không nhìn thấy

**Tình huống.** Mọi tầng trên leaf đều lấy class từ một entry đã gõ kiểu, nên union đã giữ chúng.
**Leaf tự viết class của mình** và được miễn luật entry theo chính sách — nên đó là nơi duy nhất một
giá trị lệch thang còn gõ ra được.

**Dấu hiệu nhận biết**

- File nằm trong thư mục leaf.
- Class được viết trực tiếp trong markup, **hoặc** được nhấc lên một hằng số module.
- Một rule chỉ đi qua thuộc tính JSX sẽ **nhìn thẳng qua** hằng số đó.

**Tự hỏi.** Nếu nhấc chuỗi class này ra khỏi markup, có rule nào còn đọc được nó không? Nếu không,
rule đó đang thiếu một nửa công việc.

**Ranh giới**

- ↔ `TOKEN-3` và `TOKEN-4`: hai mã kia nói **giá trị nào sai**; `TOKEN-6` nói **rule phải nhìn vào
  đâu mới thấy**. Không có `TOKEN-6` thì hai mã kia bỏ sót đúng cái thư mục mà chúng sinh ra để phủ.
- ↔ `TOKEN-1`: `TOKEN-1` phủ tầng entry; `TOKEN-6` phủ phần bù của nó. Hai mã cộng lại mới kín.

**Nhấc lên hằng số là che, không phải là được phép.** Giá trị lệch thang cuối cùng trong codebase mà
bộ rule này được viết cho đã sống trong đúng một hằng số như vậy.

**Tình huống nghiệp vụ hay gặp.** Thêm một leaf mới · gom class lặp lại thành `const` cho gọn · viết
một bảng `TONE_CLASSES` hay `SIZE_CLASSES` · review một PR chỉ đọc phần JSX.

---

## `TOKEN-7` — màu ngữ nghĩa được ghép cặp theo mặt nền mang nó

**Tình huống.** Có ba vai, không phải một. **Dấu trần** dùng `text-success`. **Nền mềm** ghép
`bg-success-soft` với `text-success-soft-foreground`. **Nền đặc** ghép `bg-success` với
`text-success-foreground`. Cảnh báo và nguy hiểm theo đúng ba vai đó.

**Dấu hiệu nhận biết**

- Một token có đuôi `-soft` đang đứng ở vị trí màu chữ.
- Một glyph trần đang mượn màu vốn dành để làm nền.
- Trong theme này thì còn đọc được, sang theme kia thì mất tương phản.

**Tự hỏi.** Token này đặt tên cho **cái đĩa** hay cho **mực viết lên đĩa**? Dùng nhầm vai là trộn hai
nhiệm vụ tương phản khác nhau.

**Ranh giới**

- ↔ `TOKEN-4`: xem trên. `TOKEN-7` là **đúng bảng màu, sai vai**; `TOKEN-4` là **đứng ngoài bảng
  màu**.
- ↔ `TOKEN-1`: union có thể nhận cả hai tên vào, vì cả hai đều là token hợp lệ. Cái sai là **cặp**,
  và cặp thì không phải một thành viên.

**Tình huống nghiệp vụ hay gặp.** Dấu tích hoàn thành trong một daily quest · badge trạng thái đơn
hàng · dòng cảnh báo hạn thanh toán · mục "Đăng xuất" tô màu nguy hiểm trong một menu · ô thông báo
lỗi của form.

---

## `TOKEN-8` — kích cỡ theo **vị trí đặt**, variant theo **mức ưu tiên**

**Tình huống.** Chọn chiều cao cho một nút. Chỉ có hai token, và cả hai đều đặt tên cho một **quan hệ
tái lập được**: `sm` là hành động **nhúng** trong một row, list item, toolbar gọn hay cụm card; `md`
là hành động **đứng riêng**, chiếm một dòng hoặc neo cả một form.

**Dấu hiệu nhận biết**

- Cùng một vai trò mà đổi hình học giữa hai màn hình.
- Chiều cao được suy ra từ "nút này quan trọng hơn".
- Có padding tự chế để **bóp nhỏ** một control.

**Tự hỏi.** Nút này **nhúng trong** một thứ khác, hay nó **tự chiếm** một dòng? Trả lời được câu đó
là xong; mức ưu tiên không tham gia.

**Ranh giới**

- ↔ `TOKEN-4`: padding tự chế để bóp nút thường kéo theo một nửa bậc hoặc một giá trị trong ngoặc —
  lúc đó có **hai** mã cùng lúc, và mã gốc vẫn là `TOKEN-8`.
- ↔ `TOKEN-1`: tập kích cỡ đóng ở hai giá trị, nên chiều cao thứ ba không gõ được. Nhưng **chọn sai
  một trong hai** thì vẫn gõ được — đó là lý do mã này chỉ ở tầng `documented`.

**Độ dài nhãn không bao giờ đổi token kích cỡ.** Một nút chữ dài vẫn là một nút nhúng nếu nó nhúng.

**Tình huống nghiệp vụ hay gặp.** Nút reaction trong một row hoạt động · nút "Áp dụng" cạnh ô mã giảm
giá · nút gửi của một form đăng ký · nút "Xem tất cả" ở góc một card · cụm hành động trong một
toolbar.

---

## `TOKEN-9` — một class gọi tên token thì chưa có nghĩa gì cho tới khi theme định nghĩa nó

**Tình huống.** `max-w-app-lg` **không phải** một chiều rộng. Nó là một **yêu cầu** gửi tới biến
`--container-app-lg`. Khi biến đó không tồn tại: class vẫn được phát ra, element vẫn render, và
**không có chỗ nào đỏ**.

**Dấu hiệu nhận biết**

- Tên class đọc như một token của nhà, thuộc họ có thể suy ra tên biến.
- Union chấp nhận tên đó, nên compiler hài lòng.
- Trang lặng lẽ mất số đo của mình.

**Tự hỏi.** Cái tên này **hứa** điều gì với theme, và theme có **giữ lời** không? Phải kiểm **cả
hai** nửa: tên là thành viên union, **và** biến nó xin có trong stylesheet.

**Ranh giới**

- ↔ `TOKEN-1`: đây chính là **giá trị chết duy nhất mà union không bắt được**, và nó tệ hơn một giá
  trị lệch thang đúng vì lý do đó: giá trị lệch thang không biên dịch được, còn cái này **qua mọi
  cổng và lên production**.
- ↔ `TOKEN-4`: xem trên.

**Những tên do framework tự phân giải không thuộc phạm vi mã này.** `screen`, `full`, `fit`, `auto`,
`none`, `min`, `max`, `prose`, `px` và các đơn vị viewport không hứa gì về theme. Một rule báo cáo
chúng sẽ đẩy người viết đi định nghĩa một biến **không ai đọc** — đo trên hai repository ở lần chạy
đầu tiên: hai finding, cả hai đều sai, cả hai đều là danh sách này.

**Tình huống nghiệp vụ hay gặp.** Đổi tên một container token · xoá một biến theme tưởng là không ai
dùng · copy một layout entry sang app khác trong monorepo · dựng app mới mà quên chép phần theme.

---

## Luật

1. Thang layout là một **union đóng**; giá trị ngoài union **không gõ ra được**, không phải "bị cấm".
2. Thêm thành viên là **sửa thang**, làm trong danh sách có tên, để diff đọc ra được.
3. Mọi số đo lấy **bậc nguyên**. Không có nửa bậc, ở bất kỳ họ nào.
4. Không độ dài trong ngoặc vuông, không màu thô, dù hôm nay nó bằng đúng một bậc.
5. Thứ bậc chữ đến từ component sở hữu **cả thẻ lẫn cỡ**, không đến từ class ghép tay.
6. Rule đọc chuỗi class **trong source**, kể cả chuỗi đã bị nhấc lên hằng số module.
7. Màu ngữ nghĩa đi theo **cặp vai**: dấu trần, nền mềm, nền đặc.
8. Kích cỡ control chọn theo **vị trí đặt**; variant chọn theo **mức ưu tiên**. Hai trục không chọn
   hộ nhau.
9. Một tên token chỉ có nghĩa khi **biến nó xin** tồn tại trong stylesheet.
10. Mép của một surface và seam bên trong nó là **một** quyết định: inset 16px quanh seam 16px.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **Selector theo vị trí trong entry.** `TOKEN-1` nhận các thành viên dạng `[&>*]:px-4` **chỉ** trong
  bảng entry, vì một joined list phải pad từng row mà không được pad đường kẻ giữa các row.
- **Tên do framework tự phân giải.** `TOKEN-9` không áp cho `screen`, `full`, `fit`, `auto`, `none`,
  `min`, `max`, `prose`, `px` và đơn vị viewport.
- **Không tìm thấy stylesheet.** `TOKEN-9` **im lặng** thay vì tuyên bố mọi token đã chết. Không có
  bằng chứng thì không có finding.
- **Chỉ đọc source sản phẩm.** `TOKEN-3`, `TOKEN-4`, `TOKEN-5`, `TOKEN-9` đọc file dưới `src/`.
  Tooling và config không render gì nên nằm ngoài phạm vi.
- **Cùng sức mạnh cascade.** Khi inset chung được ép bằng `!important`, phần joined list phải thắng
  bằng một selector ngữ nghĩa **ở cùng sức mạnh**; một utility đứng trên element không làm được việc
  đó, và bằng chứng của ngoại lệ này là computed padding bằng `0px` trên trang đã render.
- **Parity trạng thái.** Skeleton và nội dung thật dùng chung mọi token. Đổi inset hay đổi kích cỡ
  control khi đang tải là nói dối về quan hệ, và làm layout nhảy khi dữ liệu về.
