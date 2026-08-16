---
id: fe-blocks-laws-b1-one-surface-owner-audit
title: audit.md
slug: /fe/blocks/laws/b1-one-surface-owner/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện luật B1: chỗ nó phân định được, chỗ repo sống đang tuân, và phần follow-up cây trust còn nợ.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `b1-one-surface-owner`

Phản biện này kiểm xem luật có chọn được đúng một mã từ **quan hệ đã nêu**, và chỉ từ đó.

## Kết luận

Chấp nhận, với một khoản nợ đã đo được ở phía sản phẩm và một khoản nợ ở phía gate.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `B1-1` so với `B1-2` | Loại trừ được khi đã nêu các phần tử có đồng hạng hay không |
| `B1-2` so với `B1-4` | Loại trừ được khi đã nêu có chủ bao ngoài hay không |
| `B1-4` so với `B1-6` | Loại trừ được khi nhóm bên trong gọi được tên; không gọi được tên thì luôn là `B1-6` |
| `B1-4` so với `B1-5` | Loại trừ được khi đã nêu hai mặt phẳng có bao giờ cùng hiển thị hay không |
| `B1-3` so với mọi mã | Loại trừ được bằng contract của vùng, không bằng ý của khối |
| `B1-7` so với `B1-1` | Loại trừ được bằng vật chứa; ngoại lệ overlay hẹp và có tên |
| Thiếu bằng chứng về nhóm | Rơi về `B1-6`, không rơi về "tuỳ người viết" |

## Repo sống đang ở đâu

**Đang tuân**, theo phiên bản đã được sửa của luật chứ không theo phiên bản tuyệt đối. Lồng mặt
phẳng xảy ra ở đúng sáu chỗ và cả sáu đều khai `isNested` tường minh: `CourseCatalogCard`,
`JobReadinessWidget`, `LeagueCard`, `TopLearners`, `WeeklyChallengeCard`, `GlobalSearchResults`.
Năm khối khác import cả hai thành viên nhưng ở hai nhánh loại trừ nhau, tức `B1-5`, không phải vi
phạm.

## Nợ đã đo được

- **Nợ sản phẩm.** Hồ sơ phán quyết ra lệnh `isNested` là API của **cả họ** `Surface*Card`. Repo
  sống chỉ có `SurfaceListCard` mang nó; `SurfaceCard` và `SurfaceFormCard` không có. Hệ quả trực
  tiếp: mã `B1-4` chỉ biểu diễn được cho danh sách, còn một đối tượng lồng không-phải-danh-sách thì
  luật buộc phải từ chối thay vì cho phép.
  Neo: `D:\Repositories\starci-academy-fe\src\components\branches\SurfaceListCard\index.tsx:23`.
- **Nợ gate.** Cùng hồ sơ ra lệnh `contract.mjs` mọc một family gate buộc Card root xuất
  `data-surface-context` từ public `isNested`. Trong repo sống, `contract.mjs` không có chữ
  `isNested` nào. Nghĩa là hôm nay `B1-4` được giữ bằng kỷ luật đọc mã, không bằng máy.
  Neo yêu cầu: `.workflows\upgrade\starci-academy\surface-in-surface-is-nested.md:65-69`.

## Nhận định

- Luật này bị bác chín lần vì bản cũ phát biểu ở dạng tuyệt đối. Bản `2.00` phát biểu ở dạng điều
  kiện, và điều kiện đó kiểm được: *gọi được tên nhóm hay không*.
- Mã `B1-6` phát ra "không gì cả" và đó là một tình huống, không phải một chỗ trống. Đây là chỗ dễ
  đọc nhầm thứ hai sau `B1-3`, nên cả hai đều được nói rõ ở ba tài liệu.
- Điểm yếu còn lại: "gọi được tên" vẫn là một phán đoán của người, không phải một phép đo. Gate chỉ
  bắt được phần hình thức — có khai `outerSurfaceOwner` hay không. Chưa có cách nào chặn một cái tên
  bịa ra cho đủ thủ tục.
- Chưa đo bằng ảnh chụp. Mọi câu về "viền nặng hay nhẹ" trong tài liệu này suy từ CSS và từ phán
  quyết cũ, không từ một lần render dưới cùng route, viewport, theme và persona.
