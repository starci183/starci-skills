---
id: fe-layouts-laws-l7-overlay-width-is-a-product-decision-audit
title: audit.md
slug: /fe/layouts/laws/l7-overlay-width-is-a-product-decision/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện luật L7: chỗ nó phân định được với L6 và L10, ba giá trị đang chạy mà gate chỉ khai được một, và những câu chưa từng đo bằng một lần render.
---

# audit.md

> Phiên bản: `1.00` · Mô-đun: `l7-overlay-width-is-a-product-decision`

Phản biện này kiểm xem luật có chọn được đúng một mã từ **việc người đọc phải làm bên trong overlay**,
và chỉ từ đó, đồng thời kiểm xem nó có đang nói hộ phần việc của luật khác cùng kệ hay không.

## Kết luận

Chấp nhận, với một mâu thuẫn đo được giữa gate và nguồn, ba giá trị đang chạy mà không có lý do đứng
cạnh, một overlay có hai chủ cho cùng một độ hẹp, và một nửa mặt bằng overlay chưa khai được gì.

Luật này khác `L6` ở một điểm nên nói ra trước. `L6` có một rule lint chạy trên đúng thư mục của nó,
còn `L7` không có máy nào canh cả. Không lint, không test, và trường gate thì đang khai sai. Mọi thứ
giữ luật này hôm nay đều là kỷ luật đọc mã.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `L7-2` so với `L7-3` | Loại trừ được bằng việc ruột có cột số bên phải hay không; một cột điều khiển là `L7-2`, một cặp nhãn với số là `L7-3` |
| `L7-3` so với `L7-4` | Loại trừ được bằng số vùng phải cùng nhìn thấy; một vùng đọc theo dòng là `L7-3`, nhiều vùng phải sống song song là `L7-4` |
| `L7-1` so với `L7-6` | Loại trừ được bằng việc plan có viết giá trị ra hay không, chứ không bằng giá trị ấy là gì |
| `L7-5` so với mọi mã | Loại trừ được bằng phép thử một câu: lý do này có đổi khi nội dung đổi không. Không đổi thì nó nói về loại vật |
| `L7-7` so với mọi mã | Loại trừ được bằng shell, và loại trừ trước tiên: `DrawerShell` với `DropdownShell` không nhận `size` nên không mã nào khác áp được |
| Chiều rộng của một cột **bên trong** overlay | KHÔNG thuộc L7. Ba cột của `global-search-body` là [`L10`](../l10-region-width-belongs-to-its-owner/INDEX.md), và chính L10 đã đếm contract ấy vào sáu chủ hàng phát chiều rộng cho con |
| Có bao nhiêu mặt phẳng có ranh giới bên trong overlay | KHÔNG thuộc L7. Đó là [`L6`](../l6-overlay-is-already-a-surface/INDEX.md), kể cả khi `cover` kéo theo một lớp đệm, vì lớp đệm ấy là `L6-3` |
| Một điều khiển bên trong chạy hết chiều ngang hay đứng gọn | KHÔNG thuộc L7. Đó là `L11`, còn đang nợ trên kệ |
| Thiếu bằng chứng về việc người đọc làm gì | Rơi về `L7-5`, tức trả câu hỏi về cho thầy, chứ không rơi về "lấy giá trị của overlay gần nhất" |

Chỗ dễ lấn nhất là dòng thứ sáu. Cùng một hồ sơ thiết kế, cùng một màn hình, và một plan viết cả
`cover` lẫn ba cột `w-72 / grow / w-72` trong một lần. Hai câu ấy sai độc lập với nhau: panel có thể
đủ rộng trong khi việc chia cột sai, và ngược lại.

## Repo sống đang ở đâu

**Tuân về giá trị, thiếu về lý do.**

Bốn overlay mở trên `ModalShell` và chúng khai ba giá trị: `xs` một lần, `sm` hai lần, `cover` một
lần. Không giá trị nào trong bốn cái là vô lý khi đối chiếu với ruột của nó. Nấc `md` chưa ai chạm,
nấc `lg` chưa có call site nào.

Đúng một trong bốn cái ghi lý do ngay cạnh giá trị, ở
`D:\Repositories\starci-academy-fe\src\components\overlays\courses\CoursePriceOverlay\component.tsx:20-22`.
`GlobalSearchOverlay` có lý do nhưng nó nằm ở `why` của contract `global-search-body` chứ không ở call
site. `SignInOverlay` và `CheckoutOverlay` không có gì.

Thang đo được thành số chứ không phải một cái tên mờ: `size` chọn một class modifier của vendor, bốn
class đầu là `max-w-xs` tới `max-w-lg` tức `20rem` tới `32rem`, và `cover` là `w-full h-full`. Repo
không ghi đè bốn token ấy, `globals.css` chỉ thêm họ `--container-app-*` của riêng nó. Neo:
`node_modules\@heroui\styles\dist\components\modal.css:220-250`,
`node_modules\@heroui\styles\dist\components\modal\modal.styles.js:33-53`,
`node_modules\tailwindcss\theme.css:335-338`, `src\app\globals.css:35-38`.

Nửa còn lại của mặt bằng thì không khai được gì. `CartDrawer` và `StarCiAiDrawer` chạy trên
`DrawerShell`, shell ấy chỉ có `placement`, nên bề ngang của hai panel này hoàn toàn do vendor quyết
và không có phán quyết nào trong kho nói về nó.

## Nợ đã đo được

- **Gate đang khai sai, và nó khai sai bằng một câu khẳng định.**
  `D:\Repositories\starci-academy-backend\.claude\fe\layouts\gate.schema.json:382-385` có sẵn trường
  `Overlay.width`, nhưng `enum` chỉ là `["cover", "chua-do-duoc"]` và `$comment` ở `:384` viết rằng
  ngoài `cover` thì "không có giá trị nào khác đo được". Câu ấy sai với nguồn: `xs` và `sm` đều đang
  chạy và đều có call site. Hệ quả là một plan hợp lệ cho `SignInOverlay` hôm nay buộc phải khai
  `chua-do-duoc` cho một giá trị đã đo được từ lâu, tức gate đang bắt người lập plan nói dối để đi
  qua. Sửa được bằng cách mở `enum` ra đủ năm nấc cộng `chua-do-duoc` cho drawer, nhưng đó là thay
  đổi GATE nên phải làm ở schema trước theo Version Rule của [kệ](../../INDEX.md).
- **Ba trên bốn lý do không nằm cạnh giá trị.** Đây là khoản nợ mà chính câu `Law` của mô-đun này
  đang đòi. `CheckoutOverlay` là chỗ khó biện minh nhất, vì khối chú thích đầu file của nó đã có bốn
  đoạn nói về những quyết định khác của cùng overlay ấy, tại `component.tsx:14-34`, nên chỗ để viết
  không thiếu.
- **`SignInOverlay` có hai chủ cho cùng một độ hẹp.** Shell mở ở `xs` là `20rem`, còn contract
  `centred-page-column` tự khai `max-w-md` là `28rem` kèm một câu `why` giải thích rất đúng cho
  `28rem`. Cái trần ấy không bao giờ chạm tới trong overlay, nhưng nó vẫn đúng cho route
  `/authentication`, nơi cùng contract này đứng dưới `authentication-panel-card` mà chính card đó
  cũng mang `max-w-md` một lần nữa. Ba lần khai độ hẹp cho một panel, hai lần trong số đó có lý do,
  và lần đang thắng thì không. Neo: `contracts\index.ts:759`, `:1747`, `:1758`, và
  `overlays\auth\SignInOverlay\component.tsx:39`.
- **Không có test nào ghim một chiều rộng nào.** Tầng overlay có đúng ba file test, ở
  `overlays\ai\StarCiAiDrawer\component.test.tsx`, `overlays\search\GlobalSearchOverlay\component.test.tsx`
  và `overlays\search\GlobalSearchOverlay\index.test.tsx`, và không file nào khẳng định một `size`.
  `L6` có ngoại lệ của nó được ghim bằng test; `L7` không có gì tương đương, nên đổi `cover` thành
  `lg` hôm nay sẽ không làm đỏ thứ gì.
- **`L7-6` và nấc `lg` được phát biểu từ API chứ không từ một lần phán.** Không overlay nào ở `md`,
  không overlay nào ở `lg`. Hai mệnh đề về chúng suy từ hành vi của `ModalShell` và từ bảng class của
  vendor. Đây là *suy luận, không có neo từ chối*.
- **Kệ và mô-đun `L6` chưa được cập nhật theo mô-đun này.** [`kệ layouts`](../../INDEX.md) ở `:102`
  vẫn để ô "Owner module" của `L7` là `—`, và ở `:114-116` vẫn viết rằng `L6` viện `L7` nhưng mô-đun
  chưa tồn tại nên lời viện dẫn không dẫn tới đâu. Trong `L6`, chỉ `INDEX.md` được sửa để trỏ sang
  đây; `audit.md:48`, `audit.md:113-114`, `changelog.md:60-61` và `example.md:265` vẫn nhắc `L7` dưới
  dạng chữ trần. Cả hai đều nằm ngoài ranh giới ghi của lần lập mô-đun này và được ghi lại ở đây thay
  vì tự ý sửa.

## Nhận định

- Hai dòng bác của luật này ít hơn hẳn `L5` với mười một dòng, nhưng chúng đắt hơn số lượng của
  chúng, vì chúng bác ở tầng lý do chứ không ở tầng giá trị. Thầy không nói `cover` thay cho `sm`, mà
  nói rằng cái giả định "modal thì hẹp" không được phép tồn tại. Một luật viết theo giá trị sẽ hết
  hiệu lực ngay overlay tiếp theo; viết theo lý do thì không.
- Điểm mạnh nhất của bản này là `narrowerBreak`. Nó biến một lý do từ lời khen nội dung thành một phép
  đo, vì nó bắt người viết nói ra cái gì hỏng khi lùi một nấc. `CoursePriceOverlay` nói được, nên `sm`
  của nó kiểm lại được. Ba overlay còn lại không nói, nên giá trị của chúng hôm nay chỉ kiểm được
  bằng cách mở hồ sơ.
- Điểm yếu nhất là mã `L7-2` và `L7-3` mỗi mã chỉ đứng trên một tới hai chỗ chạy. Chúng không phải
  phân loại rút ra từ nhiều màn hình mà là tên đặt cho hai dạng nội dung đã gặp. Overlay thứ năm rất
  có thể sẽ là một dạng thứ ba, và khi ấy đây là chỗ phải thêm mã chứ không phải chỗ ép nó vào một
  trong hai.
- `L7-7` là mã trung thực nhất và cũng là mã dễ bị đi vòng nhất, vì cách đi vòng của nó rẻ tới mức
  không ai nhận ra đang đi vòng: thêm một class `w-*` vào contract gốc của drawer. Không lint nào
  nhìn thấy, không test nào đỏ, và từ đó trở đi bề ngang của drawer có hai chủ.

## Rủi ro còn mở

- **Chưa đo bằng một lần render.** Mọi câu trong mô-đun này về chiều rộng đều đọc từ chuỗi class, từ
  bảng class của vendor và từ token của Tailwind, không từ một lần mở overlay dưới cùng route,
  viewport, theme và persona. Đặc biệt câu "ở `xs` con số tụt xuống dưới nhãn" là lời của
  `CoursePriceOverlay` chứ không phải phép đo của tài liệu này.
- **Neo vendor có thể trôi theo phiên bản.** Ba trong số các neo nằm dưới `node_modules`, ở
  `@heroui/styles` `3.2.4` và ở `tailwindcss`. Chúng là mã thật trong cây sống, nhưng một lần nâng
  phiên bản có thể đổi bảng class mà không đổi một dòng nào trong `src/`, và khi ấy con số `20rem` tới
  `32rem` trong tài liệu này hết hiệu lực trong im lặng.
- **Chiều rộng drawer là một khoảng trống thật, không phải một chi tiết.** Hai trên sáu overlay nằm
  trong khoảng trống ấy, và một trong hai là giỏ hàng, tức là một mặt thương mại. Luật hiện chỉ nói
  được là chưa nói được.
- **`L7-4` chỉ có một ví dụ và ví dụ ấy vừa là nguồn của luật.** Global Search vừa là màn hình sinh ra
  hai dòng bác, vừa là chỗ chạy duy nhất của `cover`. Một luật rút ra từ đúng một màn hình rồi kiểm
  lại bằng chính màn hình ấy thì chưa được thử thách.
- **Ranh giới với `L10` chưa có phép thử tự động.** Hai luật cùng đọc một contract, `global-search-body`,
  và cùng lấy `why` của nó làm bằng chứng. Không có gì ngăn hai mô-đun trôi tới chỗ nói khác nhau về
  cùng một dòng, ngoài việc mục `Kiểm phân định` này nói ra là chúng chia nhau thế nào.

## Điều kiện phản biện lại

- Trường `Overlay.width` trong `gate.schema.json` đổi khỏi `enum` hai giá trị, vì khi ấy khoản nợ lớn
  nhất của mô-đun này biến mất và câu `Scope` phải viết lại.
- Một overlay thứ năm xuất hiện dưới `src/components/overlays/`, hoặc một overlay hiện có đổi nấc.
- `DrawerShell` nhận thêm một prop về bề ngang, vì khi ấy `L7-7` thôi là một lời từ chối và trở thành
  một mã có giá trị để phát.
- `ModalShell` đổi mặc định, đổi thang, hoặc `@heroui/styles` nâng phiên bản làm đổi bảng
  `modal__dialog--*`.
- Có lần render đầu tiên dưới cùng route, viewport, theme và persona, vì khi ấy phần "chưa đo bằng một
  lần render" ở trên hết hiệu lực.
- Mô-đun `L11` được lập, vì nó và `L7` sẽ cùng bị hỏi về chiều ngang trong cùng một plan và ranh giới
  giữa hai bên phải được ghi đối xứng.
