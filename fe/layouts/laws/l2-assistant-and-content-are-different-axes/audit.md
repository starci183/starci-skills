---
id: fe-layouts-laws-l2-assistant-and-content-are-different-axes-audit
title: audit.md
slug: /fe/layouts/laws/l2-assistant-and-content-are-different-axes/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện luật L2: chỗ nó phân định được với L1, L4 và L6, chỗ repo sống đang tuân, và việc cả hình dạng mượn lẫn hình dạng vi phạm mới chỉ đo được ở một call site.
---

# audit.md

> Phiên bản: `1.00` · Mô-đun: `l2-assistant-and-content-are-different-axes`

Phản biện này kiểm xem luật có chọn được đúng một mã từ **quan hệ đã nêu**, và chỉ từ đó, đồng thời
kiểm xem nó có đang nói hộ phần việc của mô-đun khác hay không.

## Kết luận

Chấp nhận, với ba khoản nợ đo được: gate không có chỗ cho hai trong sáu mã, kệ vẫn đang khai `L2` là
`owed` nên bảng định tuyến mâu thuẫn với sự tồn tại của thư mục này, và toàn bộ hình dạng của việc
mượn trợ lý mới chỉ đo được ở đúng một trang.

Repo sống **đang tuân**. Đúng một chủ mount ở gốc locale, đúng ba mẩu state và cả ba đều thuộc trợ
lý, contract `global-ai-layout` khai `surface` là anh em của ba slot còn lại chứ không phải cái bọc
chúng. Union mặt nội dung khai ba giá trị và không giá trị nào là trợ lý. Grep `useGlobalAiChat`
trên toàn bộ `src` trả về bảy dòng: ba consumer trong trục trợ lý, hai dòng trong test của chính
chủ, và hai dòng của đúng một trang. Trang ấy gọi đúng ba hàm của chủ, là `setCodeContext`,
`clearCodeContext` và `open`. Nó không gọi `close` và không đọc `isOpen`.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `L2-2` so với `L2-3` | Loại trừ được bằng việc bấm vào thì phần thân của trang có bị thay hay không |
| `L2-3` so với `L2-5` | Loại trừ được bằng **danh sách tên hàm** trang gọi, không bằng cảm giác về phạm vi |
| `L2-4` so với một lần reset state của trang | Loại trừ được khi hỏi ô nào bị xoá: ô ngữ cảnh của chủ, hay state của trang |
| `L2-6` so với "trợ lý không có ở đây" | Loại trừ được bằng việc `Provider` còn hay mất |
| Thiếu bằng chứng về thứ trang muốn ở trợ lý | Rơi về `L2-5`, tức là từ chối và hỏi, không rơi về "tuỳ người viết" |

Bốn mô-đun cùng nói về cái chủ trợ lý này, và ranh giới giữa chúng là **câu hỏi nào đang được trả
lời**. `L1` trả lời chủ ấy mount mấy lần và mount cao đến đâu. `L2` trả lời trục nào sở hữu cái gì
một khi chủ ấy đã tồn tại. `L4` trả lời một điều khiển được bấm thì đổi cái gì và URL có nhúc nhích
không. `L6` trả lời bên trong drawer có mấy mặt phẳng có ranh giới. Không mô-đun nào trong bốn cái
đó nói về việc trợ lý được grounding tới đâu, vì đó là quyết định của backend và dòng bác `:120` để
nó ở đấy.

Có một chỗ `L2` **không** được lấn: danh sách route mà trợ lý không vẽ. Danh sách ấy nằm trong một
predicate dùng chung, và `L1` đã nhận nó qua input `hiddenRoutes`. Mô-đun này chỉ nói điều gì vẫn
phải đúng trên những route đó, chứ không kể lại chúng là route nào.

Còn một chỗ nữa dễ lấn mà bản này tránh: `ContentTabRow` vẽ hàng mặt nội dung ra sao, hàng ấy rộng
hết chiều ngang hay đứng gọn, và hai hàng trong cùng toolbar chia nhau ra sao. Toàn bộ chuyện đó
thuộc `L4` và thuộc `L11` khi mô-đun ấy tồn tại. `L2` chỉ phán một điều về hàng ấy, rằng trợ lý
không có tên trong đó.

## Neo dùng chung với `L1`

`L1` và `L2` cùng neo vào một nhánh mã, `GlobalAiChatLayout\index.tsx:56-62`, và đọc nó theo hai
cách không mâu thuẫn nhau.

| Mô-đun | Đọc nhánh ấy là gì | Kết quả |
|---|---|---|
| `L1-2` | Một cách **ẩn** mà vẫn giữ mount | Số lần mount không đổi; `optional` bật trên vùng |
| `L2-6` | Một cam kết rằng **context vẫn chảy** khi phần vẽ ra biến mất | Consumer đọc context ở đó không được vỡ |

Hai câu này cùng đúng và cùng cần thiết. Bỏ câu của `L1` thì có người sẽ unmount để ẩn. Bỏ câu của
`L2` thì có người sẽ giữ mount nhưng trả `<Surface />` trần, và cây React vỡ ở trang đầu tiên gọi
hook trong vùng đó. Ghi lại ở đây để lần sau ai sửa nhánh ấy biết là mình đang đứng dưới hai luật.

## Nhận định

- **Hai lần bác, hai chiều ngược nhau, một hồ sơ.** Dòng `:710` chặn việc kéo trợ lý xuống thành một
  mặt của trang, dòng `:417` chặn việc để một mặt của trang mọc ra trợ lý riêng. Một luật có neo ở
  cả hai chiều thì mạnh hơn một luật bị bác bốn lần cùng một chiều, vì nó không thể bị đọc thành một
  sở thích.
- **Bản sửa của `:710` là một sự thay thế, không phải một lần xoá.** Mặt AI rời khỏi hàng và mặt
  `source` vào chỗ đó. Nếu module chỉ chép chữ "bỏ mặt AI" thì lần sau người đọc sẽ bỏ mặt AI và để
  lại một hàng hai mặt, tức là làm đúng một nửa lời phán.
- **`L2-3` và `L2-5` là ranh giới duy nhất trong mô-đun này đo được bằng máy.** Nó là một danh sách
  tên hàm trong một file. Ba mã còn lại phải đọc bằng nghiệp vụ.
- **Chỗ mạnh nhất của bản này là `L2-6`,** vì nó là mã duy nhất có một test ghim đúng câu mà luật
  muốn nói, và tên của test cũng nói đúng câu ấy.

## Vi phạm còn sống

Không có, trong phạm vi đo được. Bảy dòng `useGlobalAiChat` đều hợp lệ, hàng mặt nội dung khai ba
giá trị, và không trang nào giữ `isOpen`.

Cần nói rõ giới hạn của câu đó. Phạm vi đo là các file gọi `useGlobalAiChat`, cộng `ContentTabRow`,
cộng contract `global-ai-layout`. Một trang tự dựng cuộc hội thoại thứ hai mà **không** đi qua hook
ấy, chẳng hạn bằng cách gọi thẳng socket AI, sẽ không xuất hiện trong phép đo này và cũng không có
rule lint nào nhìn thấy nó. Không có `no-second-assistant-in-page` nào tồn tại.

## Quyết định

- **Phát biểu luật bằng trục, không bằng danh sách cấm.** Bản đầu tiên viết ra là "không đặt AI vào
  hàng tab". Câu đó đúng nhưng chỉ chặn được một chiều, và chiều còn lại là chiều thầy bác ở `:417`.
  Chữ "hai trục" là chữ duy nhất bao được cả hai.
- **Tách `L2-3` khỏi `L2-5` thành hai mã.** Cả hai đều nói về quan hệ giữa trang và trợ lý, và để
  chung một mã thì mã ấy sẽ vừa cho phép vừa cấm. Tách ra thì mỗi mã có một câu trả lời và ranh giới
  giữa chúng là một danh sách tên hàm.
- **Đặt `L2-6` thành mã riêng thay vì để nó nằm trong `L1-2`.** `L1-2` nói về mount, `L2-6` nói về
  hợp đồng giữa hai trục. Chúng dùng chung một neo mã nhưng trả lời hai câu hỏi, và cách hỏng của
  chúng cũng khác nhau.
- **Không nhận chuyện grounding vào mô-đun này.** Dòng `:120` là một neo từ chối thật và nó nói về
  việc luồng global cố ý không neo vào trang nào. Đó là chuyện backend đọc gì chứ không phải chuyện
  trục nào sở hữu cái gì, nên nó đứng ở mục ngoại lệ và không được tính vào hai lần bác.
- **Không nhận chiều rộng của hàng mặt nội dung.** `ContentTabRow` là một call site của `L11` và của
  `L4`. Trộn nó vào đây sẽ làm hai quyết định khác nhau dùng chung một câu.

## Rủi ro còn mở

- **~~Kệ vẫn khai `L2` là `owed`.~~ Đã xong ở kệ `1.01`.** [`../../INDEX.md`](../../INDEX.md) trước
  đây để ô "Owner module" của `L2` là `—` với Kind là `owed`, và đoạn ngay dưới bảng viết rằng ba
  luật `L2`, `L7`, `L11` có neo từ chối nhưng chưa có mô-đun. Cả hai câu đó sai kể từ khi thư mục này
  tồn tại, nên hàng đã trỏ vào đây và đoạn văn đã được viết lại. Đó là thay đổi kệ, và dòng phiên bản
  của kệ đã tăng theo.
- **Gate không có chỗ cho hai mã.** `gate.schema.json` đã mang `RegionRole` với bốn vùng của khung
  trợ lý ở `98-100`, `GlobalAiChatLayout` trong `reusesLayout` ở `473` và `global-ai-layout` trong
  `frameContract` ở `500`, nên `L2-1` khai được. Nhưng không có trường nào cho union mặt nội dung mà
  một trang sở hữu, và không có trường nào cho việc một trang khai nó mượn gì ở trợ lý. `L2-2` và
  `L2-3` hôm nay chỉ tồn tại trong văn xuôi `reason.why`. Thêm trường là thay đổi GATE và phải làm ở
  schema trước.
- **Hình dạng của việc mượn mới đo được ở một chỗ.** `CourseLearnContentPage` là trang duy nhất từng
  mượn trợ lý. Mọi câu trong `L2-3` và `L2-4` về việc trang gọi hàm nào, dọn ở đâu và không giữ cái
  gì đều suy từ một call site. Một trang thứ hai mượn theo cách khác sẽ là bằng chứng mới, và có thể
  là bằng chứng phản bác.
- **Ô ngữ cảnh có hai người dọn và luật không nói ai là người có thẩm quyền.** Chủ xoá theo
  `anchor.path` ở `index.tsx:36-38`, trang xoá theo `selectedFace` ở
  `CourseLearnContentPage\index.tsx:143`, và khi đổi bài thì cả hai đường cùng chạy vì trang cũng
  reset `selectedFace` về `reading` ở `:134-140`. Hôm nay hai lần xoá cùng một ô nên kết quả giống
  nhau, nhưng nếu ô ấy đổi thành một cấu trúc có nhiều phần thì thứ tự sẽ bắt đầu có nghĩa.
- **`L2-6` không có neo từ chối.** Nó được phát biểu từ mã và từ một test, không từ một lần thầy
  phán. Đây là *suy luận, có neo code nhưng không có neo từ chối*, và nó được ghi đúng như vậy chứ
  không mượn hai dòng bác của hai mã kia.
- **Chưa đo bằng ảnh chụp.** Câu quan trọng nhất của luật này, rằng đổi trang thì cuộc hội thoại và
  drawer đứng nguyên, được đọc từ danh sách phụ thuộc của một `useEffect` chứ không từ một lần mở
  drawer rồi bấm sang bài khác dưới cùng route, viewport, locale, theme và persona. Câu ấy đúng theo
  mã và chưa được chứng minh trên màn hình.
- **Trục trợ lý không lấy chiều ngang, đo bằng một dòng style nội tuyến.** `StarCiAiFab` đặt
  `position: "fixed"` ở `component.tsx:35` và contract khung là `relative w-full`. Đó là bằng chứng
  đủ để nói trợ lý không chiếm cột của trang, nhưng nó không nói gì về việc drawer mở ra có đẩy nội
  dung hay không, và chuyện đó chưa render lần nào để biết.

## Điều kiện phản biện lại

- Một trang thứ hai gọi `useGlobalAiChat`, vì khi ấy hình dạng của việc mượn có hai mẫu chứ không
  còn một.
- `ContentFaceId` thêm hoặc bớt một giá trị, vì union ấy là chỗ lời bác `:710` đang được giữ.
- Nhánh ở `GlobalAiChatLayout\index.tsx:56-62` đổi cách trả về, vì cả `L1-2` lẫn `L2-6` đứng trên nó.
- `gate.schema.json` mọc một trường cho mặt nội dung hoặc cho việc mượn trợ lý, vì khi ấy `L2-2` và
  `L2-3` hết là văn xuôi.
- Kệ sửa dòng `97` và đoạn `114-116` của [`../../INDEX.md`](../../INDEX.md), vì khi ấy khoản nợ đầu
  tiên ở trên hết hiệu lực.
- Có lần render đầu tiên mở drawer rồi điều hướng dưới cùng route, viewport, locale, theme và
  persona, vì khi ấy phần "chưa đo bằng ảnh chụp" hết hiệu lực.
