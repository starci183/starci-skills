---
id: fe-patterns-icon-audit
title: audit.md
slug: /gates/patterns/icon/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định, tầng giữ và khả năng neo vào code thật của luật Icon.
---

# audit.md

> Version: `2.00` · Module: `icon`

Audit này kiểm ba thứ: luật có chọn được **một** quyết định từ các dữ kiện đã nêu không, mỗi mã đang
được **cái gì** giữ, và mã đó **chỉ được ở đâu** trong code thật.

## Verdict

Chấp nhận, kèm một khoảng hở lớn đã đo được: **13 mã, 5 rule, 3 mã được rule giữ.** Luật đúng và phân
định được; điều nó chưa có là cơ chế. Bản chuyển đổi này không sửa điều đó — nó **đo** điều đó, vì
một luật tự nhận là được enforce trong khi không phải là thứ nguy hiểm hơn một luật thừa nhận mình
chỉ là chữ.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `ICON-1` vs `ICON-2/3/4` | Loại trừ được: một bên hỏi **có mấy vai trò**, một bên hỏi **vai trò vẽ bằng bản nào** |
| `ICON-2` vs `ICON-3` | Loại trừ được khi đã nêu glyph mở đầu một vùng hay dẫn một dòng |
| `ICON-3` vs `ICON-4` | Loại trừ được khi đã nêu vị trí có vỏ riêng hay chưa |
| `ICON-3` vs `ICON-12` | Loại trừ được: **vẽ bằng gì** khác **có được vẽ không** |
| `ICON-5` vs ngoại lệ brand | Loại trừ được bằng một câu hỏi: đổi màu thì mark còn là mark đó không |
| `ICON-6` vs `ICON-7` | Loại trừ được: **file nào import** khác **import cái gì**; hai rule cũng tách đúng theo đường đó |
| `ICON-9` vs `ICON-6` | Loại trừ được khi đã nêu thiếu ý nghĩa hay thiếu hình |
| `ICON-10` vs `ICON-12` | Loại trừ được khi đã nêu lưới ô lặp lại hay một row đơn lẻ |
| `ICON-11` vs `ICON-2` | Loại trừ được: bề mặt đổi khác vị trí trong nội dung đổi |
| `ICON-13` vs `ICON-7` | Loại trừ được: artwork đóng khác catalogue |
| Thiếu dữ kiện về tập xung quanh | `ICON-12` không tự quyết được; phải hỏi **một** câu về tập peer rồi dừng |

## Findings

- **Ba mã được rule giữ, một mã được kiểu giữ, chín mã chỉ có chữ.** `ICON-6`, `ICON-7`, `ICON-10` có
  rule đứng tên. `ICON-1` được union vai trò và prop shape của leaf giữ ở mức không viết ra được. Chín
  mã còn lại phụ thuộc hoàn toàn vào người đọc.
- **Rule thứ năm không mang mã nào trong luật này.** `starci-fe/rank-artwork-is-a-closed-set` giữ một
  ngoại lệ có tên của `ICON-7`, còn comment trong file rule lại chú thích nó là `ICON-11`. Trong luật
  gốc `ICON-11` nghĩa là **glyph trên plate**. Đây là một va chạm số hiệu có thật.
- **`starci-fe/no-off-scale-glyph-size` không thuộc riêng mã nào.** Nó bắt `size-4.5` và `size-[18px]`
  ở **mọi** phần tử, tức là giữ phần dư của `ICON-1` chứ không giữ trọn một mã. Ghi đúng như vậy trong
  bảng tầng giữ.
- **Test parity mà luật gốc tuyên bố không tìm thấy trong source.** `ICON-9` viết rằng "source parity
  tests reject a missing row, a stale component name or duplicate glyph ownership"; tìm trong source
  chỉ thấy bảng và map nằm cùng thư mục, không thấy test nào đọc bảng đó.
- **`ICON-12` đang bị vi phạm ngay tại composite gần nó nhất.** Recipe `label-led` render fact phụ ở
  `text-xs` `muted` — đúng nửa sau của mã — nhưng vẫn vẽ glyph, tức là nửa đầu của mã chưa được giữ ở
  chính chỗ luật mô tả. Một call site thật đang dùng recipe đó cho một row tóm tắt đơn lẻ.
- **Bảng 42 dòng ý nghĩa → hình không được chép sang module.** Bảng đó nằm trong file luật phẳng cũ và
  vẫn còn nguyên ở đó. Lý do không chép: một bảng vận hành bị nhân đôi sẽ trôi, và bảng đó gọi tên các
  tính năng của một sản phẩm cụ thể, tức là đứng sai shelf. `ICON-9` vì vậy **trỏ** tới bảng nguồn
  trong source thay vì mang thêm một bản sao thứ ba.
- **Ngoại lệ artwork được ghi trung thực.** Ngoại lệ giải thưởng tự ghi rằng đường checked-in là cơ
  chế mạnh hơn và nó không được chọn vì tài nguyên không có trong repository — đó là một quyết định
  sản phẩm được ghi lại, không phải một tuyên bố rằng nó tốt hơn.

## Decisions

- Giữ đúng 13 mã, đúng số hiệu và đúng nghĩa: `ICON-1` … `ICON-13`. Không đánh số lại, kể cả chỗ số
  hiệu va nhau.
- Giữ nguyên mọi quyết định của luật phẳng: ba vai trò, hai family, một vendor, `currentColor`,
  `shrink-0`, bảng nguồn sở hữu việc chọn hình, hai ngoại lệ artwork.
- Ghi tầng giữ **theo cơ chế thật**, không theo mong muốn. `enforced` chỉ được viết khi rule có tên.
- Ghi neo **theo đường dẫn có thật**, kể cả khi chỗ neo đang cho thấy một vi phạm — một mã neo vào
  chỗ nó đang bị vi phạm vẫn kiểm được, còn một mã không neo được thì chỉ là đề xuất.
- Không chép bảng ý nghĩa 42 dòng; trỏ về bảng nguồn và ghi lý do ở đây.
- Không sửa file luật phẳng, không sửa file rule. Bản này chỉ tái diễn đạt.

## Rủi ro còn mở

Chín mã dưới đây chỉ ở tầng `documented`. Mỗi mã ghi rõ **một rule sẽ phải NHÌN THẤY gì** mới giữ được
nó — hoặc vì sao không rule nào giữ được.

- **`ICON-2`, `ICON-3`, `ICON-4` — không rule nào phân biệt được family.** Một rule giữ được ba mã này
  phải đọc **trong icon leaf**: lần từ import specifier ra tên local, từ tên local vào từng ô của map
  vai trò, rồi khẳng định `heading`/`leading` đến từ block 24 outline và `chip` đến từ block 16 solid,
  kèm đúng class `size-6`/`size-5`/`size-4`. Việc này làm được và chưa ai làm. Ở **call site** thì
  không rule nào cần thiết, vì vai trò đã là thứ duy nhất người gọi viết ra được.
  Điểm mù thật sự: một `<svg>` viết tay trong `size-4` box — không import, nên cả hai rule vendor đều
  im lặng.
- **`ICON-5` — màu.** Trong icon leaf, một rule đọc được: một literal `fill="#…"` hoặc `stroke="#…"`
  nằm ngoài file brand là vi phạm. Ngoài call site thì **không rule nào giữ được**, vì màu được đặt
  trên node cha; muốn bắt phải biết cây render lúc chạy, thứ lint không có.
- **`ICON-8` — `shrink-0`.** Rule sẽ phải nhìn thấy một glyph không đi qua leaf: cách nhìn khả thi nhất
  là cấm hẳn `<svg>` viết tay trong source ngoài thư mục icon, vì mọi glyph qua leaf đã có `shrink-0`
  sẵn trong cả ba chuỗi class. Nhìn "phần tử này nằm trong một flex row đang chật" thì lint không nhìn
  được.
- **`ICON-9` — parity bảng ↔ map.** Đây là việc của một **test**, không phải của lint: đọc bảng nguồn,
  đọc union và map, rồi khẳng định ba tập trùng nhau và không hình nào bị hai ý nghĩa dùng chung. Luật
  gốc nói test đó tồn tại; tìm không thấy. Đây là rủi ro đắt nhất trong danh sách, vì `ICON-9` là mã
  mà tất cả các mã khác giả định là đúng.
- **`ICON-11` — glyph trên plate.** Rule rẻ và làm được ngay: buộc theo đường dẫn leaf plate, giống
  hệt cách `no-decorative-icon-in-metric-cell` buộc theo đường dẫn một composite, và báo mọi `Icon`
  trong file đó có `role` khác `leading`. Điểm yếu còn lại: một leaf plate **thứ hai** sẽ nằm ngoài
  tầm rule, vì rule buộc theo đường dẫn chứ không theo khái niệm "plate".
- **`ICON-12` — phân biệt peer.** Không rule nào đọc được "tập này có bao nhiêu loại". Thứ đọc được là
  **proxy**: buộc theo recipe/biến thể đã đặt tên — recipe dành cho row đơn lẻ thì không được chứa
  glyph. Proxy đó đúng bằng chỗ luật đang bị vi phạm hôm nay, nên nó vừa là rule khả thi vừa là bản
  vá cho một lỗi có thật.
- **`ICON-13` — reaction.** Đây là rule dễ viết nhất còn thiếu, và nó có sẵn khuôn: quét literal, đúng
  như rule artwork giải thưởng đang làm. Rule sẽ phải nhìn thấy (1) một literal emoji Unicode trong
  source, (2) một literal đường dẫn tới thư mục artwork reaction xuất hiện ngoài reaction leaf, (3)
  một import artwork ngoài leaf đó. Cả ba đều là literal, đều thấy được.
- **Va chạm số hiệu `ICON-11`.** File rule chú thích ngoại lệ artwork giải thưởng là `ICON-11`, còn
  luật đánh số `ICON-11` cho glyph trên plate. Ở đây **bảo toàn nghĩa của luật** và ghi lại va chạm,
  vì đổi số là bẻ gãy một trích dẫn ai đó đã viết. Nếu founder muốn dọn, cách đúng là cấp cho ngoại lệ
  artwork giải thưởng **một mã mới** ở lần tăng phiên bản tiếp theo, chứ không phải đổi số cái đang có.
- **Bảng ý nghĩa không nằm trong module.** Ai đọc module này sẽ không tra được "ý nghĩa nào → hình
  nào" mà không mở source hoặc file luật phẳng. Đây là một mất mát có thật so với luật gốc, được nhận
  ở đây thay vì được giấu: bản sao thứ ba của một bảng vận hành sẽ trôi trước khi nó kịp có ích.

## Re-audit Triggers

- Có thêm một rule vào `sources/fe/icon.mjs`, hoặc một rule đang có đổi phạm vi — bảng tầng giữ phải
  đo lại.
- Có đề xuất thêm một vai trò, một family, hoặc một vendor glyph.
- Có đề xuất mở rộng một trong hai tập artwork đóng (reaction, giải thưởng).
- Một mã bị neo vào đường dẫn không còn tồn tại, hoặc đường dẫn đó đổi vai trò.
- Xuất hiện leaf plate thứ hai, hoặc composite metric thứ hai — cả hai rule buộc theo đường dẫn đều
  mù với bản sao.
- Bảng ý nghĩa và map trong source lệch nhau một lần nữa mà không có test nào báo.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
