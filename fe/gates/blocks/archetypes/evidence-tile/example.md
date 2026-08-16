---
id: fe-blocks-archetypes-evidence-tile-example
title: example.md
slug: /gates/blocks/archetypes/evidence-tile/example
sidebar_label: example.md
sidebar_position: 2
description: Một ô đầy đủ, và bảng so với hình dạng đúng.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `evidence-tile` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

---

## Một ô, nguyên trạng

```tsx
export const OverviewCourses = () => {
    const t = useTranslations("profile")
    const request = useOverviewEvidence<ReadonlyArray<Course>>("courses")
    const resting: ReadonlyArray<Course> = Array.from({ length: 2 }, (_, index) => ({ globalId: `resting-${index}`, ... }))
    const courses = request.isLoading ? resting : request.data ?? []
    const message = request.error ? t("evidence.error") : t("evidence.courses.empty")
    return <SurfaceCard props={{ label: t("evidence.courses.label") }} contract="profile-evidence-list" render={...} />
}
```

---

## So với hình dạng đúng

| Mục | Đang là | `A1` yêu cầu |
|---|---|---|
| File | một `.tsx` phẳng | thư mục, cặp `component.tsx` + `index.tsx` |
| Twin | không có | `_X` cho nửa thuần |
| `meta` | không có | có |
| Hook | trong cây component | trong `hooks/` |
| Hàng nghỉ | `length: 2` tự chọn | `CONTRACTS[key].children.<slot>.restingCount` |
| Rỗng | hàng giả `globalId: "state"` | `SurfaceCard contract="empty-notice-card"` + `EmptyNotice` |
| Lỗi | cùng câu với rỗng | nhánh riêng, có nút đọc lại |

---

## Ánh xạ

| Yêu cầu nghe được | Archetype |
|---|---|
| "thêm một ô bằng chứng nữa vào hồ sơ" | `A1`, **không** `A9` |
| "sửa ô khoá học cho đúng chuẩn" | di trú sang `A1`, bắt đầu từ nhánh rỗng |
