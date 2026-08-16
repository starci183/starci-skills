---
id: fe-layouts-laws-l1-persistent-owner-mounts-once-audit
title: audit.md
slug: /fe/layouts/laws/l1-persistent-owner-mounts-once/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện luật L1: bản cũ đã bắt nhầm sáu chỗ mount đúng, bản này phân định bằng gì, và ba khoản còn nợ.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `l1-persistent-owner-mounts-once`

Phản biện này kiểm xem luật có chọn được đúng một mã từ **bằng chứng đã nêu**, và chỉ từ đó.

## Kết luận

Chấp nhận ở bản `2.00`, sau khi bác bản `1.00`. Còn ba khoản nợ: một chuyện chưa đo được trong repo
sống, một bình luận đã cũ trong mã, và một câu vẫn còn nguyên dạng sai ở bảng định tuyến của kệ. Thêm
một mâu thuẫn chéo với [`l6-overlay-is-already-a-surface`](../l6-overlay-is-already-a-surface/INDEX.md),
ghi ở mục dưới và ghi đối xứng bên ấy.

Bản `1.00` phát biểu rằng chủ có phần nhìn thấy ở tầm toàn cục thì không mount vào chrome lặp theo
cụm route. Đọc thẳng câu đó thì sáu chỗ mount `ShellNav` đều vi phạm. Đo lại thì cả sáu đều đúng, và
còn có một test đang bắt buộc đúng cách bố trí ấy ở
`D:\Repositories\starci-academy-fe\src\app\[lang]\authentication\layout-boundary.test.ts:24-25`.
Trust nói một đằng, mã và test nói một nẻo, nên đây là một finding phải xử chứ không phải chỗ để
chọn bên nào tiện hơn. Mã đúng.

Chỗ hỏng của bản cũ có tên: nó chép lại **kết luận** của dòng từ chối mà bỏ mất **lý do**. Dòng gốc
ở `.workflows\designs\starci-academy\global-ai-chatbot.md:708` nói chrome lặp sẽ làm rơi trạng thái
hội thoại khi đi xuyên cụm. Cắt vế sau đi thì phần còn lại thành một lệnh cấm về hình thức, và lệnh
cấm về hình thức bắt nhầm ngay lần đầu gặp một chrome không giữ trạng thái nào.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `L1-1` so với `L1-3` | Loại trừ được khi đã gọi tên từng mẩu state và chỉ ra hook nào đọc nó từ địa chỉ |
| `L1-2` so với `L1-4` | Loại trừ được bằng việc chủ còn nằm trong cây hay không, chứ không bằng việc nó có hiện hay không |
| `L1-1` so với `L1-5` | Loại trừ được khi đã nêu phạm vi sống sót là xuyên cụm hay trong một cụm |
| `L1-1` so với `L1-6` | Loại trừ được bằng việc chủ có phát bố cục hay không |
| `L1-3` so với `L1-7` | Loại trừ được khi đo state theo từng mẩu; chủ vừa có mẩu tính lại được vừa có mẩu không thì rơi vào `L1-7` |
| Thiếu bằng chứng về nguồn state | Rơi về `L1-7` và báo nợ, không rơi về "tuỳ người viết" |
| Có chạm sang kệ `blocks` không | Không. Luật này không nói chủ vẽ gì, chỉ nói nó mount mấy lần và ở đâu |
| Có chạm sang `principles` không | Không. Seam, offset và mặt phẳng của chrome sau khi mount là chuyện của kệ đó |
| Có đè lên `invisible-owner` không | Có giao nhau và đã phân vai: `KEEPER-1` chọn điểm mount cho một keeper, `L1` quyết định trước đó rằng chủ này có phải keeper không |
| Có đè lên `L2` không | Không. `L2` nói trợ lý và các mặt nội dung là hai trục khác nhau, không nói mount ở đâu |

## Repo sống đang ở đâu

Đang tuân, theo bản `2.00` chứ không theo bản `1.00`.

`GlobalAiChatLayout` mount đúng một lần ở `src\app\[lang]\layout.tsx:101` và giấu phần nhìn thấy ở
`GlobalAiChatLayout\index.tsx:56-62`. `ShellNav` mount ở sáu route-group layout và không giữ mẩu
điều hướng nào ngoài hai hàm của địa chỉ tại `ShellNav\index.tsx:120` và `:126`.
`PlaygroundSessionLayout` mount ở biên `slug` và giữ socket cùng session tại `:52-54`. Họ route
`authentication` không mount chrome, và một test giữ cả hai chiều của ranh giới đó.

Bốn kết quả trên đến từ bốn quyết định khác nhau, và bản `2.00` chọn đúng cả bốn bằng một câu hỏi
duy nhất. Bản `1.00` chọn sai một trong bốn.

## Nợ đã đo được

- **Nợ chưa đo được trong repo sống.** `ShellNav` giữ bốn `useState` cho overlay ở
  `ShellNav\index.tsx:53-56` và mount ba overlay ở `:162`, `:169`, `:170`. Biện hộ hiện có nằm ở
  `src\app\[lang]\cart\layout.tsx:22-24` và ở bình luận ngay trên `:169`, cả hai đều nói về phạm vi
  một cụm. Mở drawer rồi đi từ `courses` sang `dashboard` thì chrome mount lại và drawer đóng. Không
  test nào, không phán quyết nào nói đó là hành vi mong muốn. Đây là *suy luận, không có neo*, và
  `L1-7` tồn tại để giữ nó ở trạng thái nợ thay vì để luật nói như đã xong.
- **Nợ bình luận cũ trong mã.** Doc comment ở
  `src\modules\ai\content-ai-route-context.ts:63` viết rằng route đăng nhập và route chấm bài trực
  tiếp *không mount* trợ lý toàn cục. Mã ở `GlobalAiChatLayout\index.tsx:56-62` chứng minh ngược
  lại: chủ vẫn mount, chỉ bỏ phần nhìn thấy. Đúng cái khác biệt mà `L1-2` và `L1-4` tồn tại để tách
  ra thì bình luận này đang gộp lại, nên một người đọc bình luận trước rồi sửa theo nó sẽ tháo mất
  chủ.
- **Nợ trong chính cây trust.** Bảng định tuyến ở `.claude\fe\layouts\INDEX.md:96` vẫn ghi L1 ở dạng
  cũ: "A global visual owner mounts at the locale root". Câu đó là bản đã bị bác. Sửa nó là một thay
  đổi cấp kệ chứ không phải cấp mô-đun, nên nó được ghi ở đây thay vì tự sửa.

## Mâu thuẫn chéo

**`L1-7` và câu `Law` của `L6` cùng áp một tình huống và ra hai kết quả.** Tình huống: một plan thêm
overlay vào một cụm route mà chrome của cụm ấy lặp lại theo cụm — đúng ba overlay đang sống trong
`ShellNav` hôm nay.

| Mô-đun | Câu | Kết quả cho cùng tình huống ấy |
|---|---|---|
| `L1` | `L1-7`: "An address-recomputable owner nonetheless holds live overlay state → **nothing yet** — escalate as owed"; và ngoại lệ: "Refuse to bless it and escalate… the law does not speak as though it were settled." | Không phát gì. Ghi vào `owed` và hỏi. |
| `L6` | Câu `Law`: "The layout **mounts it once for a whole route cluster**, the vendor shell draws its edge…"; `L6-1` phát `buildsCardInside: false` và một ruột phẳng. | Phát đủ một khai báo overlay hợp lệ. Chỗ mount được nói như đã xong. |

Một người đọc `L6` trước sẽ khai xong overlay và đi tiếp; đọc `L1` trước thì dừng lại và báo nợ. Đó
là hai kết quả, không phải hai cách diễn đạt.

Vế nào đúng thì chưa đo được, và đây là chỗ phải nói rõ: `L1` đúng ở chỗ **chưa có phán quyết nào**
nói mất drawer khi đi xuyên cụm là hành vi mong muốn, còn `L6` đúng ở chỗ nó đang mô tả **hình dạng
đang chạy**. Cái sai chung là câu của `L6` nói hình dạng đang chạy bằng giọng của một luật đã chốt.

`L6` còn không nhắc `L1` ở đâu cả: mục `Scope` của nó đẩy câu hỏi "ai mount overlay" sang
[`invisible-owner`](../../archetypes/invisible-owner/INDEX.md) và
[`sticky-chrome-band`](../../archetypes/sticky-chrome-band/INDEX.md) `CHROME-7`, tức sang hai mô-đun archetype,
trong khi số lần mount và độ cao mount nay thuộc mô-đun này. Cùng một luật nằm ở hai chỗ là đúng cái
hình mà `L8` và `L10` cấm.

Sửa được bằng một trong hai đường, và cả hai đều là thay đổi luật chứ không phải sửa chữ, nên chúng
được ghi chứ chưa được làm: hoặc câu `Law` của `L6` nói rõ nó nhận điểm mount như một dữ kiện đã đo
chứ không phán về nó, hoặc `L6-1` bắt khai `mountOwner` đã qua `L1` trước khi khai
`buildsCardInside`.

## Nhận định

- Bản `1.00` sai không phải vì thiếu bằng chứng mà vì rút gọn bằng chứng. Bài học kiểm được: một
  dòng từ chối phải được chép cả cột `Why`, và luật phải phát biểu theo cái `Why` đó chứ không theo
  cái được chọn thay thế.
- `L1-2` và `L1-4` là chỗ dễ đọc nhầm nhất trong mô-đun, nên cả ba tài liệu đều nói rõ. Đọc gộp
  chúng hỏng theo hai hướng ngược nhau, và một trong hai hướng chỉ lộ ra khi người đọc quay lại sau
  một bài thi.
- Điểm yếu còn lại: "địa chỉ tính lại được" kiểm bằng cách đọc mã, không bằng máy.
  `gate.schema.json` không có trường nào mang `stateOrigin`, nên hôm nay `L1-1` được giữ bằng kỷ
  luật đọc `useState` chứ không bằng gate. Thêm trường đó là một thay đổi gate, không phải thay đổi
  mô-đun.
- Chưa đo bằng ảnh chụp. Mọi câu trong tài liệu này về chuyện cái gì còn trên màn hình sau một lần
  điều hướng đều suy từ mã nguồn và từ phán quyết cũ, không từ một lần render dưới cùng route,
  viewport, theme và persona.
