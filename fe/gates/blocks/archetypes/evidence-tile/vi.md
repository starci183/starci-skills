---
id: fe-blocks-archetypes-evidence-tile-vi
title: vi.md
slug: /gates/blocks/archetypes/evidence-tile/vi
sidebar_label: vi.md
sidebar_position: 1
description: Sáu ô bằng chứng hồ sơ: đúng vai trò, sai hình dạng, và ghi lại đúng như nó đang là.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `evidence-tile` · Luật: [`INDEX.md`](./INDEX.md)

# Ô bằng chứng hồ sơ

Sáu ô trên tab tổng quan của hồ sơ công khai: khoá học, kỹ năng code, kỹ năng thử thách, đóng góp,
sẵn sàng nghề, ảnh chụp kỹ năng.

Về **vai trò** chúng giống `A1` — một tập hàng dưới một cái tên. Về **hình dạng** chúng không theo
bất cứ luật nào của tầng.

## Vì sao vẫn ghi chúng vào kệ

Vì chúng đang chạy. Một archetype được nhận vào kệ khi có neo tới thứ đã ship. Ghi chúng như thể
chúng là `A1` sẽ giấu sáu file thật khỏi người đọc kệ này; không ghi gì cả cũng vậy.

Mô-đun này ghi lại **đúng như nó đang là**, kèm một câu rõ ràng: ô mới không chép hình này.

## Bốn chỗ lệch khuôn

1. File `.tsx` **phẳng** — không thư mục, không cặp `component`/`index`, không twin `_X`.
2. Không export `meta`. Chín trong mười file thiếu `meta` của cả tầng nằm ở đây.
3. Hai hook riêng (`useOverviewEvidence`, `usePublicWeeklyStats`) nằm **ngay trong cây component**.
4. Số hàng nghỉ tự chọn, không đọc từ registry.

Cả bốn chỗ đều không gate nào thấy: regex của luật file-layout chỉ khớp `pages` và `layouts` (cộng
`overlays` qua một regex thứ hai), **không** khớp `blocks`.

## Chỗ sai thật sự

Rỗng và lỗi bị gộp thành **một** chuỗi rồi nhét vào danh sách như một hàng giả mang
`globalId: "state"`:

```tsx
const message = request.error ? t("evidence.error") : t("evidence.courses.empty")
...
(courses.length > 0 ? courses : [{ ...resting[0], globalId: "state", label: message }])
```

Câu "chưa có gì" được đọc bằng đúng văn phạm của một dòng dữ liệu thật. Đây vừa là vi phạm `b4`, vừa
là vi phạm `b12` — vì lỗi và rỗng nói cùng một câu ở cùng một chỗ, người đọc không phân biệt được.

## Chỗ làm đúng

Mỗi ô đúng một `SurfaceCard`. Và mỗi ô một request riêng, cache riêng — nên chúng settle độc lập,
đúng tinh thần `b11`.
