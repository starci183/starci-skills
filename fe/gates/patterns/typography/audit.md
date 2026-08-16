---
id: fe-patterns-typography-audit
title: audit.md
slug: /gates/patterns/typography/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định, tầng giữ và khả năng neo của luật Typography.
---

# audit.md

> Version: `2.00` · Module: `typography`

Audit này kiểm hai thứ: luật có chọn được một bộ **cỡ + độ đậm + tông** từ **quyền sở hữu nội dung đã
nêu** và chỉ từ đó hay không, và mỗi mã đang được **giữ bằng cái gì** — kiểu, rule, hay chỉ một người
đọc.

## Verdict

Chấp nhận, kèm một cảnh báo đã ghi rõ: **năm trên chín mã chỉ được giữ bằng người đọc**. Luật đúng và
neo được ở source thật, nhưng đừng đọc bảng `Tầng giữ` như một bản báo cáo mức bao phủ của lint — nó là
bản kê chỗ luật này còn hở.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `TYPESET-1` vs `TYPESET-9` | Loại trừ được bằng một dữ kiện: dòng có nằm trong outline không |
| `TYPESET-1` vs `TYPESET-8` | Loại trừ được: nhãn sinh từ dữ liệu thì biến mất khi dữ liệu trống |
| `TYPESET-2` vs `TYPESET-9` | Loại trừ được: cần **cấp** hay cần **title body** trong một cấp đã có |
| `TYPESET-3` vs `TYPESET-4` | Loại trừ được: `TYPESET-3` cấm phương tiện, `TYPESET-4` chỉ hướng đi |
| `TYPESET-5` vs `TYPESET-7` | Loại trừ được, nhưng **kém sắc nhất** trong toàn module — xem Findings |
| `TYPESET-6` vs `TYPESET-9` | Loại trừ được: heading hay body, không có trường hợp thứ ba |
| `TYPESET-7` vs `TYPESET-8` | Loại trừ được: giải thích một dòng, hay chia một nhóm kết quả |
| Thiếu chủ sở hữu | Lấy bậc nhỏ hơn; chỉ một câu hỏi phân định về object đang được trưng bày |

## Findings

- **Chín mã, một rule, ba kiểu đóng.** `TYPESET-1` được giữ bằng
  `no-heading-tag-outside-heading-component`; `TYPESET-2`, `TYPESET-6`, `TYPESET-7` được giữ bằng kiểu
  đóng ở hai leaf sở hữu chữ; năm mã còn lại chỉ có người đọc.
- **Prompt dựng module này dự đoán "ít nhất tám mã documented"; con số thật là năm.** Chênh lệch không
  phải do nới tay: ba mã kia được kiểm bằng `tsc` chứ không bằng lint, và tầng `unrepresentable` tồn
  tại đúng để ghi trường hợp đó. Bằng chứng nằm ở bảng `Anchor`, kiểm lại được bằng cách thử viết ra
  giá trị sai.
- **`TYPESET-5` và `TYPESET-7` chồng lấn ở bảng Forbidden của luật phẳng.** Dòng "một dòng phụ cùng cỡ
  với title" được chỉ định cách sửa là "bậc caption 12px hạn chế cộng tông muted" — tức là kéo luôn
  `TYPESET-7` vào làm lời giải mặc định của `TYPESET-5`. Nhưng cùng cỡ khác độ đậm cũng là một thứ
  bậc hợp lệ, và luật phẳng thừa nhận điều đó ở dòng "compact peer label" trong bảng quyết định.
  Đã giữ **cả hai** bằng cách viết ngoại lệ đóng "độ đậm là toàn bộ khác biệt giữa hai peer", thay vì
  im lặng chọn một bên.
- **Tầng giữ mạnh nhất lại nằm ở những mã ít bị vi phạm nhất.** Cái mà kiểu chặn được là **giá trị
  sai** (`size: "xs"` + tông chính, `level: 5`, `weight` trên heading). Cái mà luật này thật sự bị vi
  phạm nhiều nhất là **quan hệ giữa hai dòng đều hợp lệ** — và không kiểu nào nhìn thấy quan hệ.
- **Luật phẳng gọi tên một component riêng ở `TYPESET-8`.** Đã tổng quát hoá thành "surface danh sách
  đã có nhãn của chính nó", bảo toàn quyết định (nhãn nằm ngoài surface, surface ẩn nhãn của nó).
- **Rule lint có một twin ở `tokens.mjs`** bắt heading ghép từ cỡ to và độ đậm nặng. Nó thật và nó
  giữ một nửa của `TYPESET-1`, nhưng nó **không** do `sources/fe/typography.mjs` publish, nên bảng
  `Tầng giữ` không tính nó. Ghi ở đây để người đọc sau không kết luận rằng nửa đó đang bỏ ngỏ.

## Decisions

- Giữ đúng chín mã, đúng số và đúng nghĩa: `TYPESET-1` … `TYPESET-9`. Không đánh số lại, không thêm mã
  mới, kể cả ở những chỗ audit này thấy có chồng lấn.
- Giữ nguyên mọi quyết định thật của luật phẳng: bảng bốn cấp, hai bậc body, một bậc 12px hạn chế,
  bảng quyết định title body, và toàn bộ bảng Forbidden.
- Chỉ dán nhãn `enforced` khi đã tìm thấy rule và gọi được tên nó. Đúng một mã đạt điều kiện đó.
- Chỉ dán nhãn `unrepresentable` khi đã đọc kiểu ở source và viết ra được câu "giá trị sai này không
  compile". Ba mã đạt điều kiện đó.
- Mọi ví dụ ở dạng TSX thường; component chỉ xuất hiện ở chỗ **ranh giới component chính là luật**.
- Bất đồng đi vào mục dưới đây, không đi vào một lần sửa im lặng.

## Rủi ro còn mở

**Năm mã chỉ có người đọc giữ.** Với mỗi mã: một rule sẽ phải **nhìn thấy** gì mới giữ được nó.

- **`TYPESET-3` — thứ bậc không đến từ một cái khung.** Rule sẽ phải phân biệt được một cái viền vẽ để
  *nhấn mạnh* với một cái viền vẽ để *gom nhóm* hay để *báo trạng thái*. Cả ba đều là `border` hoặc
  `bg` trên một element bọc chữ. Sự khác nhau nằm ở **ý định**, và ý định không có trong AST. Xấp xỉ
  khả dĩ: đếm số surface có viền trên một block và cảnh báo khi vượt ngưỡng — đó là một heuristic, và
  canon không nhận heuristic làm rule.
- **`TYPESET-4` — hạ hàng xóm thay vì nâng nó lên.** Rule sẽ phải nhìn thấy **hướng của một thay đổi**,
  tức là so sánh hai revision chứ không đọc một file. Một gate diff-based có thể làm được: "diff chỉ
  tăng bậc, không hạ bậc nào" là một câu hỏi trả lời được. Đó là một loại công cụ khác lint, và hiện
  chưa có.
- **`TYPESET-5` — dòng phụ xếp dưới title.** Rule sẽ phải biết **dòng nào là title của dòng nào**. Hai
  sibling cùng `text-sm` là hợp lệ trong vô số trường hợp; chỉ khi một bên *thuộc về* bên kia thì nó
  mới sai. Quan hệ đó không được viết ra ở bất kỳ đâu trong markup. Rule chỉ khả thi nếu contract bắt
  buộc khai báo vai trò (ví dụ một slot `title` và một slot `meta`), tức là phải đổi **hình dạng dữ
  liệu** trước, rồi mới đổi được tầng giữ.
- **`TYPESET-8` — mốc thời gian là subtitle muted.** Rule sẽ phải biết chuỗi đang render là một **nhãn
  thời gian sinh từ dữ liệu**. Nhìn được một nửa: nếu contract đánh dấu trường đó là partition label,
  rule bắt được ngay khi nó bị đưa vào heading. Không nhìn được nửa còn lại: một chuỗi tự do như
  `"Hôm nay"` viết thẳng vào một heading là hợp lệ với mọi công cụ tĩnh.
- **`TYPESET-9` — bậc title theo chủ sở hữu nội dung.** Rule sẽ phải biết dòng này đại diện cho một
  object **đang được trưng bày** hay là một dòng lặp lại. Có một xấp xỉ đáng cân nhắc và không phải
  heuristic: `text-base font-medium` bên trong một callback `.map()` gần như luôn sai, vì "lặp lại"
  và "chiếm ưu thế" loại trừ nhau. Đây là ứng viên rule khả thi nhất trong năm mã, và nó chưa được
  viết.

**Hai neo yếu hơn vẻ ngoài.**

- `TYPESET-4` neo vào **trần thang** (cấp 1 là `text-xl font-semibold`, không phải `text-3xl
  font-bold`). Nó chứng minh rằng "to hơn" gần như không tồn tại; nó **không** chứng minh rằng tác giả
  đã hạ hàng xóm.
- `TYPESET-9` neo vào **phân bố call site**: một prompt chiếm ưu thế ở 16px medium so với khoảng ba
  mươi title gọn ở 14px medium. Phân bố đúng không chứng minh từng call site đúng.

**Hai chỗ từ vựng lệch nhau, chưa sửa vì sửa là đổi luật.**

- Luật gọi bậc 16px là `text-base`; leaf sở hữu chữ gọi cùng bậc đó là `size: "md"`. Người đọc luật
  literally sẽ đi tìm một giá trị **không tồn tại** trong union. Đã bảo toàn từ vựng của luật phẳng
  trong luật và dùng lớp CSS trong ví dụ; hợp nhất tên là một đề xuất rule change.
- Leaf sở hữu chữ mặc định `size = "md"`, tức **16px là mặc định khi không nói gì**, trong khi bảng
  quyết định của `TYPESET-9` coi 14px là bậc của phần lớn body. Mặc định đang kéo ngược luật, và một
  call site im lặng sẽ rơi vào bậc lớn hơn bậc mà luật dự định. Đây là rủi ro thật, thuộc loại phải
  đo trước khi đổi.

**Một chỗ mặc định làm `TYPESET-1` hở.** Leaf heading khai `level` là **tuỳ chọn**, mặc định `2`. Một
caller quên nói cấp vẫn compile và vẫn render ra `h2`. Rule lint chỉ bắt tag viết tay, không bắt một
cấp **không được nêu ra**. Nếu muốn `TYPESET-1` chặt đúng như câu chữ của nó ("một prop quyết cả
hai"), prop đó phải là bắt buộc — và đó là một breaking change trên toàn bộ call site, nên nó nằm ở
đây chứ không nằm trong một lần sửa im lặng.

## Re-audit Triggers

- Có đề xuất thêm một cỡ, một độ đậm hoặc một tông mới vào thang.
- Có yêu cầu cấp heading thứ năm lần thứ hai trong cùng một quý — lúc đó vấn đề là cấu trúc thông
  tin, không phải kiểu chữ.
- `sources/fe/typography.mjs` publish thêm rule, hoặc rule twin ở `tokens.mjs` đổi phạm vi.
- Union `size`/`tone` hoặc union `level` ở hai leaf sở hữu chữ thay đổi.
- Mặc định `size` của leaf chữ hoặc mặc định `level` của leaf heading thay đổi.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
- Có người kết luận rằng bảng `Tầng giữ` chứng minh luật này đã được tự động hoá.
