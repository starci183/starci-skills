---
id: fe-layouts-laws-l6-overlay-is-already-a-surface-vi
title: vi.md
slug: /gates/layouts/laws/l6-overlay-is-already-a-surface/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng mã L6-N nhận diện bằng nghiệp vụ, và vì sao một cái tên kết thúc bằng -card không phải là bằng chứng của một mặt phẳng.
---

# vi.md

> Phiên bản: `1.00` · Mô-đun: `l6-overlay-is-already-a-surface` · Luật: [`INDEX.md`](./INDEX.md)

# Overlay tự nó đã là mặt phẳng

Khi một overlay mở ra, người đọc đã thấy một vật có ranh giới: nền sau tối đi, cái panel có mép, có
nút đóng, có bẫy focus, và mọi thứ còn lại của trang lùi ra sau nó. Ranh giới đó do shell của nhà
cung cấp vẽ, và nó đã trả lời xong câu hỏi *cái gì đang thuộc về việc này*. Dựng thêm một card bên
trong là trả lời lại câu hỏi đó lần thứ hai, và lần thứ hai luôn thừa.

Luật này ít bị bác, đúng ba lần trên hai hồ sơ, nhưng nó bị đi vòng nhiều hơn số lần bị bác. Không
ai viết `SurfaceCard` ngay dòng đầu của một dialog; người ta đặt tên một vùng là `…-card`, hoặc
thêm một tiêu đề mà cái drawer đã tự xưng ở thanh trên, hoặc viết padding hai lần vì cả shell lẫn
contract đều tưởng phần đệm là của mình. Ba chỗ đó mới là nơi luật thật sự làm việc.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Plan khai gì |
|---|---|---|
| `L6-1` | Thêm một overlay cho cụm route | `buildsCardInside: false`, ruột là các region contract phẳng |
| `L6-2` | Shell đã vẽ tên của panel | **không có vùng tiêu đề** bên trong; shell không vẽ tên thì ruột giữ tiêu đề |
| `L6-3` | Ruột cần phần đệm | đúng một chủ phần đệm, gọi tên ra: shell hoặc contract gốc |
| `L6-4` | Bên trong có một tập hàng đồng hạng có thật | một mặt phẳng lồng, do **block** giữ, khai `isNested: true` |
| `L6-5` | Một vùng bên trong trông như panel | contract `Tree` phẳng có padding riêng, **không nhánh surface** |
| `L6-6` | Vật bounded bên trong không phải danh sách | **từ chối**, và ghi vào `owed` |

## `L6-1` — ruột là region phẳng

Tình huống: plan thêm một panel nổi cho cả cụm route, ví dụ giỏ hàng mở từ navbar hay bảng giá mở
từ thẻ khoá học. Câu hỏi duy nhất cần trả lời là *ai đang giữ ranh giới*, và câu trả lời đã có sẵn:
shell giữ nó.

Hai overlay trong repo sống ghi thẳng phán quyết này vào comment ngay cạnh chỗ ra quyết định, bằng
gần như cùng một câu, rằng panel phủ đã là vật có ranh giới nên một `SurfaceCard` bên trong sẽ vẽ
thêm một đường viền và một lớp đệm thứ hai quanh cái thân vốn đã được đóng khung. Không một file
nào trong `src/components/overlays/` import bất kỳ nhánh surface nào, và chỗ này có một cái máy
canh chứ không chỉ có kỷ luật đọc mã.

Câu tự hỏi: *nếu bỏ cái viền bên trong đi, người đọc có mất thông tin gì về việc những thứ này
thuộc về nhau không?* Trong overlay thì không bao giờ mất, vì cái nền tối phía sau đã nói điều đó
rồi.

## `L6-2` — panel đã tự xưng tên

Tình huống: một drawer, hoặc một dialog có tiêu đề do shell vẽ. `DrawerShell` dựng
`Drawer.Header` bọc `Drawer.Heading` và nhận `title` như một prop bắt buộc, nghĩa là cái tên đã nằm
ở thanh trên trước khi ruột kịp render.

`CartDrawer` ghi lại lý do ở ngay đầu file: nó không giữ tiêu đề nào, vì drawer đã đặt tên cho
panel trong header của nhà cung cấp, và một tiêu đề thứ hai bên trong sẽ gọi tên đúng cái thứ mà
người đọc vừa mới mở, hai lần. Contract gốc của nó nói lại đúng điều đó trong `why` của mình.

Đây là mã dễ bỏ sót nhất khi port một khối từ trang vào overlay, vì trên trang thì khối ấy **phải**
có nhãn. Chuyển vào drawer thì nhãn mất chủ, chứ không phải mất chỗ.

Mặt kia của cùng một mã quan trọng không kém. `ModalShell` không vẽ tên nào cả, nó chỉ có nút đóng,
nên ruột của một modal **giữ** tiêu đề của mình. `course-price-detail-stack` mở đầu bằng đúng một
slot `heading` và đó là hợp lệ. Đọc xem shell nào đang đứng dưới trước khi xoá một tiêu đề, vì hai
shell trả lời hai câu khác nhau cho cùng câu hỏi.

## `L6-3` — phần đệm viết đúng một lần

Cả hai shell đều zero phần đệm của nhà cung cấp. `ModalShell` trả `Modal.Body` với `p-0`,
`DrawerShell` trả `Drawer.Body` với `p-0` và giải thích ngay tại chỗ rằng ruột tự giữ padding của
nó, nên một shell cũng padding nữa sẽ chèn hai lớp cho cùng một nội dung và hai lớp đó sẽ trôi khỏi
nhau theo thời gian.

Hệ quả là overlay **không có sẵn một lớp đệm thứ hai** để một cái card lấy làm cớ. Đo trong repo
sống, các contract gốc chia nhau hai cách và cách nào cũng chỉ có một chủ: giỏ hàng khai `p-4` ở
`cart-drawer-column`, thanh toán khai `p-6` ở `checkout-panel-column`, bảng giá khai `p-6` ở
`course-price-detail-stack`, còn Global Search không khai gì cả vì shell đã viết `p-4` lên
`Modal.Dialog` khi `size="cover"`.

Khi lập plan, gọi tên chủ ra. Không gọi tên thì hai bên sẽ cùng viết, và cái nhìn thấy được là một
lớp đệm dày gấp đôi chứ không phải một lỗi ai cũng đọc ra từ code.

## `L6-4` — một vật bên trong có thật

Tình huống: bên trong overlay có một tập hàng đồng hạng, có tên riêng, có trạng thái rỗng riêng và
có kết quả riêng. Ví dụ sống duy nhất là cột giữa của Global Search, và thầy yêu cầu nó bằng đúng
một câu: *trò render SurfaceListCard ở giữa chứ*.

Ba điều kiện phải đúng cùng lúc:

1. Tập bên trong là **hàng đồng hạng**, không phải một nhóm gồm những phần khác loại.
2. Tập bên trong **gọi được tên**: nói được tên nó, thành viên nó, trạng thái riêng và kết quả riêng.
3. Lời khai do một **block** đưa ra, không phải do file overlay, và block đó khai `isNested: true`
   kèm tên chủ bên ngoài.

Điều kiện thứ ba không phải thủ tục. File overlay không thể khai được lời khai đó, vì rule
`no-surface-branch-in-overlay` báo lỗi trên mọi import một trong bốn nhánh surface từ bất kỳ file
nào nằm dưới `overlays/`. `GlobalSearchResults` sống ở `blocks/search/`, nên nó nói được điều mà
`GlobalSearchOverlay` không nói được.

Đi kèm là mặt còn lại của cùng một quyền: khi danh sách rỗng, block **thay** cả mặt phẳng danh sách
bằng `EmptyNotice` chứ không đặt notice vào trong một mặt phẳng thứ hai.

## `L6-5` — trông như panel mà không phải

Tình huống: một vùng bên trong overlay có phần đệm riêng, có nhóm nội dung riêng, và có một cái tên
kết thúc bằng `-card`. `global-search-context-card` là đúng như thế: khoá của nó có chữ card, nó
mang `p-4`, và nó là một contract `Tree` với năm slot leaf. Không có border, không có radius, không
có shadow, không có nền.

Cái tên là nhãn của một vùng chứ không phải bằng chứng của một ranh giới. Đọc mảng `classes` trước
khi tin cái khoá, và đừng đổi tên vùng chỉ để nó trông tuân thủ hơn, vì cái tên đang mô tả đúng vai
trò mà nó đóng cho người đọc.

Ranh giới với `L6-4`: cột ngữ cảnh giữ một tiêu đề, một loại, một trích đoạn, một trạng thái và một
nút. Đó là năm phần khác loại của **một** lời phát biểu, không phải một tập thành viên, nên nó
không có gì để sở hữu.

## `L6-6` — từ chối và ghi nợ

Tình huống: bên trong overlay cần một vật có ranh giới thật, nhưng nó không phải một danh sách hàng
đồng hạng. Hôm nay điều đó **không biểu diễn được**: chỉ `SurfaceListCard` có `isNested`, còn
`SurfaceCard` và `SurfaceFormCard` thì không.

Cách xử lý là ghi vào `owed` và dừng, chứ không tự sơn một cái viền lên contract bên trong overlay.
Cái viền tự sơn ấy chính là chủ sở hữu thứ hai mà luật này sinh ra để chặn, và nó còn tệ hơn một
`SurfaceCard` thật ở chỗ không có rule nào nhìn thấy nó.

## Luật

Overlay là mặt phẳng có ranh giới, do layout mount một lần cho cả cụm route và do shell của nhà
cung cấp vẽ mép. Plan khai ruột của nó là các region contract phẳng, khai `buildsCardInside: false`,
để tên panel cho shell và gọi tên đúng một chủ phần đệm. Một vật có ranh giới thứ hai chỉ được vào
khi nó là một tập hàng đồng hạng gọi được tên, và khi lời khai đến từ một block ở tầng dưới với
`isNested: true` cùng tên chủ bên ngoài.

## Ngoại lệ

- **Một vật bên trong có thật.** `L6-4`, đúng một chỗ trong cây sống, và có một test ghim nó lại
  chứ không chỉ có văn xuôi.
- **Một vùng mang tên card.** `L6-5`. Khoá contract được phép kết thúc bằng `-card` trong khi
  contract vẽ một cột phẳng.
- **Overlay cỡ cover lấy phần đệm từ shell.** `L6-3`. `ModalShell` viết `p-4` lên dialog khi
  `size="cover"` và chỉ khi ấy, nên contract gốc bên trong không khai padding. Vẫn là một chủ.
- **Modal thì ruột giữ tiêu đề.** `L6-2`. `ModalShell` không vẽ tên nào, nên lệnh "bỏ tiêu đề bên
  trong" chỉ đúng cho `DrawerShell`.
- **Vật bounded bên trong không phải danh sách.** `L6-6`. Từ chối và báo nợ.

## Vì sao luật ít bị bác mà hay bị đi vòng

Ba dòng từ chối trên hai hồ sơ là con số nhỏ so với các luật khác cùng kệ, nhưng nó không có nghĩa
là luật này dễ. Đọc lại cả hai hồ sơ thì thấy ba cách trượt lặp lại:

- **Hiểu "không card trong overlay" thành "không có vật nào bên trong".** Sai, vì cột giữa của
  Global Search là một tập hàng có thật và thầy yêu cầu nó bằng tên. Bản đúng là *chỉ một tập gọi
  được tên mới được vẽ ranh giới, và lời khai phải đến từ tầng block*.
- **Tin cái tên thay vì mảng `classes`.** Một khoá contract kết thúc bằng `-card` không dựng mặt
  phẳng nào, còn một contract tên rất hiền có thể mọc `border` lúc nào không hay. Chỉ có mảng
  `classes` là bằng chứng.
- **Tưởng rule lint đã canh hết.** `no-surface-branch-in-overlay` chỉ nhìn các file nằm dưới
  `overlays/`. Mọi thứ block mang vào nằm ngoài tầm nhìn của nó, và đó vừa là chỗ ngoại lệ hợp lệ
  sống, vừa là chỗ một vi phạm sẽ đi qua mà không ai báo.
