---
id: fe-patterns-tokens-audit
title: audit.md
slug: /gates/patterns/tokens/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định, tầng giữ và khả năng neo được của luật Tokens.
---

# audit.md

> Version: `2.00` · Module: `tokens`

Audit này kiểm hai thứ: luật có chọn được **một** quyết định từ dữ kiện đã nêu hay không, và mỗi mã
**thật sự** được giữ bởi cái gì — chứ không phải cái mà nó tự nhận.

## Verdict

Chấp nhận, với hai điều phải nói to.

Thứ nhất: **module này có chín mã, không phải mười.** Luật phẳng gốc đánh số `TOKEN-1` tới `TOKEN-9`
và không có mã thứ mười ở bất kỳ đâu trong cây trust. Yêu cầu chuyển đổi ghi là mười. Luật là nguồn
sự thật, và bịa thêm một mã để cho đủ số sẽ tạo ra một citation không ai từng viết. Chín mã được
bảo toàn số, nguyên nghĩa; sai lệch về số lượng ghi ở đây thay vì được sửa âm thầm.

Thứ hai: **chỉ bốn trên chín mã có thứ gì đó cơ học giữ.** Một mã được union giữ, bốn mã được rule
giữ, bốn mã còn lại chỉ có người đọc giữ. Đó là số đo, không phải lời than.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `TOKEN-1` vs `TOKEN-4` | Loại trừ được khi đã nêu **tầng file** — entry đã gõ kiểu, hay leaf tự viết class |
| `TOKEN-1` vs `TOKEN-2` | Loại trừ được khi đã nêu câu hỏi đang đặt: "gõ được không" hay "làm sao để gõ được" |
| `TOKEN-2` vs `TOKEN-3` | Loại trừ được khi đã nêu nhu cầu lặp lại trên bao nhiêu màn hình |
| `TOKEN-3` vs `TOKEN-4` | Loại trừ được bằng hình dạng giá trị: dấu chấm thập phân, hay ngoặc vuông |
| `TOKEN-4` vs `TOKEN-7` | Loại trừ được khi đã nêu token nằm trong hay ngoài bảng màu ngữ nghĩa |
| `TOKEN-4` vs `TOKEN-9` | Loại trừ được khi đã nêu tên đó là độ dài viết thẳng hay là yêu cầu gửi tới một biến |
| `TOKEN-5` vs `TOKEN-1` | Loại trừ được khi đã nêu rằng từng class **đều** hợp lệ và cái sai nằm ở tổ hợp |
| `TOKEN-6` vs mọi mã đo đạc | Loại trừ được khi đã nêu chuỗi class được viết ở đâu: markup, hằng số, hay mảng entry |
| `TOKEN-8` vs `TOKEN-4` | Loại trừ được khi đã nêu chiều cao đến từ token sai hay từ padding tự chế |
| Thiếu dữ kiện | Hỏi **một** câu trong bảng phân định của `example.md` rồi dừng |

## Findings

- **Union và rule chia nhau đúng một đường cắt**, và đường đó là **tầng file**. Mọi tầng trên leaf
  lấy class từ entry đã gõ kiểu; leaf tự viết class và được miễn luật entry theo chính sách. Không có
  mã nào rơi vào khe giữa hai bên.
- **`TOKEN-9` là mã duy nhất mô tả một lỗi qua được mọi cổng.** Bốn mã còn lại hoặc không compile,
  hoặc bị rule bắt. Mã này compile, render, xanh hết — và mất số đo. Nó xứng đáng được đọc trước
  những mã khác khi audit một adoption mới.
- **`TOKEN-6` không phải một mã có thể vi phạm.** Nó là một tuyên bố về **phạm vi phủ**: nó nói rule
  phải nhìn vào đâu. `isSourceFile` và nhánh `VariableDeclarator` trong `tokens.mjs` **hiện thực**
  nó, nhưng không rule nào đỏ lên được khi phạm vi phủ bị thiếu. Giữ mã này vì nó giải thích vì sao
  ba mã kia đọc hằng số, và vì citation cũ đã trỏ vào nó.
- **`TOKEN-8` bị chẻ làm đôi giữa hai tầng.** Tập kích cỡ đóng ở hai giá trị nên chiều cao thứ ba
  không gõ ra được; nhưng chọn nhầm một trong hai thì vẫn gõ được. Bảng tầng giữ ghi `documented` vì
  cái mà **luật** nói là **cách chọn**, và cách chọn thì không có gì giữ.
- **Luật phẳng gốc có những quyết định thật mà không mang số**: bảng sáu bậc, phép thử hai dữ kiện của
  `gap-2`, việc **không có bậc số không**, các inset 16/24 đối xứng và 12/8, 16/12 bất đối xứng, cặp
  "mép 16px quanh seam 16px", và toàn bộ cách joined list giữ mép 16px mà không pad đường kẻ. Chúng
  được bảo toàn trong `## Law` của `INDEX.md` và được neo ở hai dòng cuối bảng `## Anchor`. Chúng
  **không** được nâng thành mã mới, vì thêm mã là bịa citation.
- **Mọi mã đều neo được vào code thật.** Không mã nào phải ghi `chưa neo được`.

## Decisions

- Giữ đúng chín mã: `TOKEN-1` … `TOKEN-9`, nguyên số và nguyên nghĩa.
- Không tạo `TOKEN-10`, dù yêu cầu chuyển đổi nói module có mười mã.
- Gọi tên rule theo **khoá export** trong `tokens.mjs` — `no-fractional-step`, `no-arbitrary-value`,
  `no-hand-rolled-heading`, `no-unresolved-token-class` — chứ không kèm prefix plugin, để record này
  không mang tên riêng của một sản phẩm.
- Ghi `unrepresentable` **chỉ** cho `TOKEN-1`, nơi union thật sự làm giá trị sai không gõ được.
- Ghi `enforced` **chỉ** khi đã đọc được rule trong `tokens.mjs` và gọi được tên nó.
- Giữ mọi ví dụ ở dạng TSX thường, class thường, không tên sản phẩm và không component library.
- Neo bằng đường dẫn tương đối repository, và làm rõ trong `## Scope` rằng đường dẫn là **bằng
  chứng**, không phải từ vựng mà luật định nghĩa.

## Rủi ro còn mở

Bốn mã dưới đây chỉ ở tầng `documented`. Với mỗi mã: một rule sẽ phải **nhìn thấy cái gì** mới giữ
được nó, hoặc vì sao không rule nào giữ được.

- **`TOKEN-2` — thêm thành viên là sửa thang.** Không rule nào giữ được, và đây là bất lực **về bản
  chất** chứ không phải thiếu công sức: một rule lint đọc **một trạng thái** của source, còn mã này
  nói về **chất lượng của một thay đổi**. Muốn giữ, thứ đọc phải là **diff** chứ không phải file —
  một cổng CI thấy union bị sửa và đòi thay đổi đó đứng riêng trong commit của chính nó, kèm mô tả
  quan hệ mà bậc mới đặt tên. Đó là luật review, không phải luật lint.

- **`TOKEN-6` — phạm vi phủ.** Không rule nào **vi phạm** được nó, vì nó nói về chính bộ rule chứ
  không nói về source sản phẩm. Thứ giữ được nó là **test của rule**: một negative control chứng minh
  rằng gỡ nhánh `VariableDeclarator` khỏi `classTextVisitors` sẽ làm một case đỏ chuyển thành xanh.
  Chừng nào test đó còn thì mã này còn được giữ **gián tiếp**; bảng tầng giữ vẫn ghi `documented` vì
  không có gì đỏ lên trong repository sản phẩm.

- **`TOKEN-7` — cặp vai màu ngữ nghĩa.** Rule làm được, và đây là ứng viên `enforced` rõ nhất còn
  lại. Nó phải nhìn thấy: trong **một** chuỗi class, một token nền dạng `bg-<role>-soft` xuất hiện mà
  không có `text-<role>-soft-foreground` đi kèm; hoặc ngược lại, một token đuôi `-soft` đứng ở vị trí
  `text-*` khi trong chuỗi **không** có `bg-*` nào. Hai cái bẫy đã biết trước: cặp bị tách qua hai
  element cha–con thì một rule đọc từng chuỗi sẽ báo nhầm, và một bảng tra kiểu `TONE_CLASSES` gom
  cặp vào một dòng chuỗi lại **hợp lệ** và phải xanh. Vì thế rule này phải bắt đầu ở phạm vi hẹp:
  một chuỗi class, một element.

- **`TOKEN-8` — kích cỡ theo vị trí đặt.** Không rule lint nào giữ được **vế chính** của nó, vì "hành
  động này nhúng trong một row hay đứng riêng chiếm một dòng" là một dữ kiện của **cây render**, và
  cây render không nằm trong file chứa nút. Có hai mảnh **giữ được**: một rule cấm padding tự chế
  trên một press target — nó chỉ cần nhìn thấy `px-*`/`py-*` trên cùng một element với vai trò nút —
  và một test render khẳng định mọi nút bên trong một row của list đều có `data-size="sm"`. Cả hai
  đều là hàng rào quanh mã, không phải chính mã.

Ngoài bốn mã trên, còn hai rủi ro về cách đọc:

- **Số mã không khớp với thứ mà quy trình chuyển đổi tưởng.** Nếu sau này ai đó thêm `TOKEN-10` để
  cho khớp một con số, họ đang tạo ra một mã mà **không luật cũ nào từng trỏ tới**. Việc cần làm
  ngược lại: sửa con số ở chỗ đếm sai.
- **`TOKEN-1` dễ bị đọc thành "đã an toàn tuyệt đối".** Union đóng chỉ phủ **tầng entry**. Ba mã đo
  đạc và toàn bộ `TOKEN-9` tồn tại vì phần còn lại vẫn hở.

## Re-audit Triggers

- Có đề xuất thêm một thành viên vào union từ vựng, hoặc thêm một inset mới.
- Có rule mới trong `tokens.mjs`, hoặc một rule cũ đổi tên — bảng `## Tầng giữ` phải chạy lại.
- Một mã đang `documented` được nâng lên `enforced`, hoặc ngược lại.
- Một anchor không còn tồn tại ở đường dẫn đã ghi, hoặc symbol ở đó đổi tên.
- Xuất hiện một class token mà theme không định nghĩa và không rule nào báo — nghĩa là
  `TOKEN_CLASS_FAMILIES` đang thiếu một họ.
- Một repository mọc ra một union song song dưới tên khác.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
