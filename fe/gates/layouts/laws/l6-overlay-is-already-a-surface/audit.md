---
id: fe-layouts-laws-l6-overlay-is-already-a-surface-audit
title: audit.md
slug: /gates/layouts/laws/l6-overlay-is-already-a-surface/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện luật L6: chỗ nó phân định được với B1-7 và VENDOR-8, chỗ repo sống đang tuân, và cái khe mà ngoại lệ lẫn vi phạm cùng đi qua.
---

# audit.md

> Phiên bản: `1.00` · Mô-đun: `l6-overlay-is-already-a-surface`

Phản biện này kiểm xem luật có chọn được đúng một mã từ **quan hệ đã nêu**, và chỉ từ đó, đồng thời
kiểm xem nó có đang nói hộ phần việc của kệ khác hay không.

## Kết luận

Chấp nhận, với một khoản nợ đo được ở gate, một khe cấu trúc mà chính ngoại lệ đang sống trong đó, và
một mâu thuẫn chéo với
[`l1-persistent-owner-mounts-once`](../l1-persistent-owner-mounts-once/INDEX.md) ghi ở mục riêng bên
dưới và ghi đối xứng bên ấy.

Repo sống **đang tuân**. Sáu file component dưới `src/components/overlays/` được đọc hết, không file
nào import `SurfaceCard`, `SurfaceListCard`, `SurfaceAccordionCard` hay `SurfaceFormCard`; hai chỗ
duy nhất chữ ấy xuất hiện trong mã sản xuất là hai comment giải thích vì sao không dùng. Sáu
contract gốc mà các overlay ấy mở vào, gồm `cart-drawer-column`, `checkout-panel-column`,
`course-price-detail-stack`, `global-search-workspace`, `starci-ai-drawer-column` và
`centred-page-column`, đều là cột `flex` và không cái nào mang `border`, `rounded`, `shadow` hay
nền. Đúng một mặt phẳng lồng tồn tại, do một block khai, và nó có test ghim.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `L6-1` so với `L6-5` | Loại trừ được bằng mảng `classes`, không bằng khoá contract |
| `L6-4` so với `L6-5` | Loại trừ được khi đã nêu tập bên trong là hàng đồng hạng hay các phần khác loại |
| `L6-4` so với `L6-6` | Loại trừ được bằng thành viên họ Surface nào mang được lời khai; không phải danh sách thì không biểu diễn được |
| `L6-2` so với một điều khiển đứng đầu | Loại trừ được khi hỏi bỏ nó đi thì người đọc mất gì |
| `L6-2` giữa hai shell | Loại trừ được bằng shell: `DrawerShell` nhận `title` bắt buộc, `ModalShell` không vẽ tên nào |
| `L6-3` khi shell đệm | Loại trừ được vì `ModalShell` chỉ đệm ở `size="cover"`, và đó là một chủ chứ không phải hai |
| Thiếu bằng chứng về nhóm bên trong | Rơi về `L6-1`, không rơi về "tuỳ người viết" |

Ba kệ cùng nói về overlay, và ranh giới giữa chúng là **tầng nào đang phát biểu**. `L6` ở kệ
`layouts` quyết định plan khai gì cho một overlay mà layout mount. `B1-7` ở kệ `blocks` quyết định
một khối được mount vào overlay thì phát ra gì. `VENDOR-8` ở kệ `patterns` phát biểu lệnh cấm
import, và `no-surface-branch-in-overlay` ở kệ `lints` thi hành nó trên đường dẫn file. Không kệ nào
trong ba kệ đó nói về chiều rộng, vì chiều rộng là `L7`.

Có một chỗ `L6` **không** được lấn: ai mount overlay. Điều đó thuộc
[`invisible-owner`](../../archetypes/invisible-owner/INDEX.md) và
[`sticky-chrome-band`](../../archetypes/sticky-chrome-band/INDEX.md) `CHROME-7`, và schema đã tách sẵn hai
trường khác nhau là `mountOwner` với `buildsCardInside`. Mô-đun này chỉ cấp giá trị cho trường thứ
hai.

Câu vừa rồi đúng về ý nhưng thiếu một tên, và chỗ thiếu ấy là gốc của mâu thuẫn ghi ngay dưới đây:
số lần mount và độ cao mount nay do
[`l1-persistent-owner-mounts-once`](../l1-persistent-owner-mounts-once/INDEX.md) giữ, chứ không chỉ
do hai mô-đun archetype.

## Mâu thuẫn chéo

**Câu `Law` của mô-đun này và `L1-7` cùng áp một tình huống và ra hai kết quả.** Tình huống: một plan
thêm overlay vào một cụm route mà chrome của cụm ấy lặp lại theo cụm — đúng ba overlay đang mount
trong `ShellNav` hôm nay tại
`D:\Repositories\starci-academy-fe\src\components\layouts\ShellNav\index.tsx:162,169,170`.

| Mô-đun | Câu | Kết quả cho cùng tình huống ấy |
|---|---|---|
| `L6` | Câu `Law`: "The layout **mounts it once for a whole route cluster**, the vendor shell draws its edge…"; `L6-1` phát `buildsCardInside: false` và một ruột phẳng. | Khai xong, hợp lệ, đi tiếp. |
| `L1` | `L1-7`: "An address-recomputable owner nonetheless holds live overlay state → **nothing yet** — escalate as owed"; và ngoại lệ: "Refuse to bless it and escalate… the law does not speak as though it were settled." | Không phát gì. Ghi vào `owed` và hỏi. |

Câu "Vi phạm còn sống: không có" ở dưới **chỉ đúng trong phạm vi ranh giới mặt phẳng**. Nó không có
nghĩa là chỗ mount của ba overlay ấy đã sạch: `L1` đang giữ đúng chỗ đó ở trạng thái nợ, vì mở drawer
rồi đi từ `courses` sang `dashboard` thì chrome mount lại và drawer đóng, và không phán quyết nào nói
đó là hành vi mong muốn.

Cái sai chung không phải ở một trong hai kết quả mà ở giọng: câu `Law` của mô-đun này mô tả **hình
dạng đang chạy** bằng ngữ pháp của một luật đã chốt, trong khi vế mount của hình dạng ấy chưa được
phán. Sửa được bằng một trong hai đường, cả hai đều là thay đổi luật nên chỉ được ghi: hoặc câu `Law`
nói rõ nó **nhận** điểm mount như dữ kiện đã đo chứ không phán về nó, hoặc `L6-1` bắt khai
`mountOwner` đã qua `L1` trước khi khai `buildsCardInside`.

## Nhận định

- Luật này ít bị bác, đúng ba dòng trên hai hồ sơ, nhưng số lần bị bác không đo được độ khó của nó.
  Cái nó thật sự chặn không phải một `SurfaceCard` viết ra cố ý mà là ba đường đi vòng: một cái tên
  kết thúc bằng `-card`, một tiêu đề nói lại cái shell đã nói, và một lớp đệm do hai bên cùng viết.
- Ngoại lệ duy nhất được phát biểu bằng **tầng** chứ không bằng tên component, và đó là điểm mạnh
  nhất của bản này. Câu "chỉ block mới khai được" kiểm được bằng đường dẫn file, còn câu "chỉ khi
  nào nó thật sự là một vật" thì không.
- `L6-5` là mã dễ đọc nhầm nhất và nó đang sống thật:
  `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2881-2890` mang chữ `card`
  trong khoá và không dựng mặt phẳng nào.

## Vi phạm còn sống

Không có. Đây là mô-đun duy nhất trong đợt này không mang một vi phạm đo được, và điều đó có lý do
cấu trúc chứ không phải may: `VENDOR-8` là một trong số ít luật của cây có rule lint riêng chạy trên
đúng thư mục của nó.

Cần nói rõ giới hạn của câu "không có vi phạm": nó đúng cho **file overlay**. Nội dung mà block mang
vào overlay không nằm trong phạm vi đo của rule, và tài liệu này chỉ đo được một block trong số đó.

## Quyết định

- **Phát biểu luật bằng tầng, không bằng danh sách cấm.** Bản cũ nằm trong `CHROME-7` dưới dạng một
  vế ngắn "không dựng card bên trong". Bản này thêm điều kiện thứ ba của `L6-4`, rằng lời khai phải
  đến từ block, vì đó là điều kiện duy nhất trong ba điều kiện mà máy kiểm được.
- **Tách `L6-2` và `L6-3` ra thành mã riêng.** Cả hai đều là hệ quả trực tiếp của "overlay đã là mặt
  phẳng" và cả hai đều có neo code, nên để chúng ẩn trong văn xuôi là bỏ mất hai chỗ luật hay bị
  trượt nhất.
- **Không nhận chiều rộng vào mô-đun này.** Hồ sơ thiết kế có một dòng từ chối riêng cho chiều rộng
  ở `.workflows\designs\starci-academy\global-search-modal-20260815.md:259`, và nó thuộc `L7`.
- **Không đưa dòng `:581` của hồ sơ thiết kế vào bảng `Anchor`.** Nó là một hàng
  `APPLY FINDING` với ba cột `Finding · Evidence · Impact`, không phải một hàng `REJECTED` với cột
  `Why`, nên nó không đủ tư cách làm neo từ chối dù nội dung nói đúng chuyện này.

## Rủi ro còn mở

- **Gate không biểu diễn được ngoại lệ.** `gate.schema.json` khai
  `Overlay.buildsCardInside` là `const: false`. Một plan hợp lệ cho Global Search hôm nay phải khai
  `false` trong khi bên trong nó có một mặt phẳng lồng thật, do block khai. Nghĩa là gate và luật
  đang nói hai điều khác nhau về cùng một màn hình. Sửa được bằng cách đổi trường ấy thành một enum
  ba giá trị, nhưng đó là thay đổi GATE và phải làm ở schema trước.
  Neo: `D:\Repositories\starci-academy-backend\.claude\gates\layouts\gate.schema.json`, `$defs.Overlay`.
- **Khe mà rule không nhìn thấy.** `no-surface-branch-in-overlay` thoát ngay khi đường dẫn file
  không chứa `/src/components/overlays/`, rồi chỉ khớp `import` kết thúc bằng một trong bốn tên
  nhánh. Ngoại lệ hợp lệ sống trong khe đó, và một vi phạm cũng sẽ đi qua đúng khe đó: một block
  mới mount `SurfaceCard` vào overlay, hoặc một contract chỉ dùng trong overlay mọc
  `rounded-xl border`, đều không bị báo.
  Neo: `D:\Repositories\starci-academy-fe\plugins\eslint-canon\vendor-boundary.mjs:246,250`.
- **`L6-6` chưa có ví dụ sống.** Không chỗ nào trong repo cần một vật bounded không-phải-danh-sách
  bên trong overlay, nên mã này được phát biểu từ giới hạn của API chứ không từ một lần thầy phán.
  Đây là *suy luận, không có neo từ chối*; neo code duy nhất đứng sau nó là việc chỉ
  `SurfaceListCard` khai `isNested`.
- **`StarCiAiDrawer` và `SignInOverlay` chưa được đo hết ruột.** Cả hai đều sạch ở tầng file, nhưng
  `INDEX.md` của kệ đã ghi sẵn rằng ruột của chúng chưa được đo, và tài liệu này không đổi được điều
  đó: nó đọc contract chứ không mở màn hình.
- **Chưa đo bằng ảnh chụp.** Mọi câu về lớp đệm, về mép panel và về việc "không có inset thứ hai"
  trong tài liệu này suy từ contract, từ mã shell và từ phán quyết cũ, không từ một lần render dưới
  cùng route, viewport, theme và persona. Riêng `centred-page-column` không khai padding nào, nên
  giá trị người đọc thật sự nhìn thấy ở `SignInOverlay` là chỗ chưa biết rõ nhất.

## Điều kiện phản biện lại

- Một overlay thứ bảy xuất hiện dưới `src/components/overlays/`.
- `buildsCardInside` đổi khỏi `const: false` trong `gate.schema.json`.
- `no-surface-branch-in-overlay` đổi phạm vi đường dẫn hoặc đổi cách khớp import.
- Một thành viên thứ hai của họ `Surface*Card` khai được `isNested`, vì khi ấy `L6-6` có thể biểu
  diễn được và không còn là một lời từ chối.
- Có lần render đầu tiên dưới cùng route, viewport, theme và persona, vì khi ấy phần "chưa đo bằng
  ảnh chụp" ở trên hết hiệu lực.
