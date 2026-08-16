---
id: fe-layouts-archetypes-destination-column-example
title: example.md
slug: /gates/layouts/archetypes/destination-column/example
sidebar_label: example.md
sidebar_position: 2
description: Từng ca của mọi mã SPINE-N, từ câu founder gõ đến mảnh LayoutPlan mà gate trả ra.
---

# example.md

> Phiên bản: `1.00` · Mô-đun: `destination-column` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mảnh `LayoutPlan` dưới đây viết đúng theo [`../gate.schema.json`](../../gate.schema.json).

---

## `SPINE-1` + `SPINE-4` — cột thật, ghim và có danh tính

### Ca: "trong khoá học, cho người ta đi qua lại giữa các mode mà không mất khung"

Câu phân định: một quyền truy cập mở nhiều mode, và người học đổi qua lại. → archetype này.

```json
{
  "pageId": "course-learn-content",
  "archetype": "destination-column",
  "archetypeReason": {
    "why": "Một lần ghi danh mở ra mười một mode learn, nên danh sách nơi có thể đi tới phải đứng cạnh thân trang để đổi mode không dựng lại khung.",
    "anchorKind": "neo-code",
    "anchor": "D:\\Repositories\\starci-academy-fe\\src\\components\\layouts\\LearnShellLayout\\component.tsx:20"
  },
  "routeCluster": "courses",
  "frameContract": "learn-shell-frame",
  "reusesLayout": "LearnShellLayout",
  "shell": "RouteShell",
  "opensMainLandmark": false,
  "mainLandmarkReason": {
    "why": "Frame vẽ khung và không vẽ gì bên trong nó, nên landmark main thuộc route file; một layout tự mở main sẽ đặt main thứ hai vào tài liệu.",
    "anchorKind": "neo-code",
    "anchor": "D:\\Repositories\\starci-academy-fe\\src\\components\\layouts\\LearnShellLayout\\component.tsx:13-15"
  },
  "regions": [
    {
      "role": "spine",
      "host": "nav",
      "optional": true,
      "persistence": "dung-yen-pixel",
      "narrowBehaviour": "doi-thanh-thanh-day-dinh-ngon-cai",
      "narrowMeasure": "viewport-md",
      "replacementWhenGone": "thanh-day-mobile",
      "widthOwner": "chinh-vung-nay",
      "widthClass": "w-72",
      "selector": "dinh-danh-data-node",
      "stickyOffsetToken": "top-rail",
      "maxHeightToken": "max-h-rail",
      "ownsScroll": true,
      "reason": {
        "why": "Cột optional nên phải nhắm bằng danh tính: nếu nhắm bằng con đầu tiên thì lúc full-bleed chính thân trang sẽ ăn chiều rộng của cột.",
        "anchorKind": "neo-code",
        "anchor": "D:\\Repositories\\starci-academy-fe\\src\\components\\contracts\\index.ts:335"
      }
    },
    {
      "role": "body",
      "host": "main",
      "persistence": "ve-lai-theo-route",
      "narrowBehaviour": "khong-doi",
      "narrowMeasure": "khong-do",
      "selector": "khong-dung-selector",
      "stickyOffsetToken": "khong-sticky",
      "maxHeightToken": "khong-gioi-han",
      "ownsScroll": false,
      "reason": {
        "why": "Thân trang là phần duy nhất vẽ lại theo route, và nó mở landmark main của chính nó chứ không được đặt vào main của người khác.",
        "anchorKind": "neo-code",
        "anchor": "D:\\Repositories\\starci-academy-fe\\src\\components\\contracts\\index.ts:2006-2008"
      }
    },
    {
      "role": "bar",
      "host": "nav",
      "optional": true,
      "persistence": "dung-yen-pixel",
      "narrowBehaviour": "khong-doi",
      "narrowMeasure": "viewport-md",
      "selector": "khong-dung-selector",
      "stickyOffsetToken": "khong-sticky",
      "maxHeightToken": "khong-gioi-han",
      "ownsScroll": false,
      "reason": {
        "why": "Dưới breakpoint của cột thì không tới được mode nào nữa, nên các lối vào ghim xuống mép dưới nơi ngón cái đã ở sẵn, và nó là nav các đích ngang hàng chứ không phải action bar cùng hình dạng.",
        "anchorKind": "neo-code",
        "anchor": "D:\\Repositories\\starci-academy-fe\\src\\components\\contracts\\index.ts:328"
      }
    }
  ]
}
```

### Sai, và vì sao

```text
spine bọc quanh body                    → đổi mode là dựng lại cả cột, khung nháy
frame tự mở <main>                      → main thứ hai trong tài liệu
top-rail nhưng không max-h-rail         → cột dài quá đáy, mục cuối không với tới khi đang dính
md:[&>*:first-child]:w-72               → lúc cột vắng mặt, thân trang ăn w-72
route link làm tab mobile               → đã bị bác, tab mobile là state cục bộ
```

---

## `SPINE-3` — bỏ hẳn cột cho bài đánh giá

```json
{
  "regions": [
    {
      "role": "spine",
      "host": "nav",
      "optional": true,
      "persistence": "dung-yen-pixel",
      "narrowBehaviour": "bien-mat",
      "narrowMeasure": "viewport-md",
      "selector": "dinh-danh-data-node",
      "reason": {
        "why": "Bốn dạng route đánh giá trực tiếp lấy cả viewport, và danh sách route đó phải là một predicate dùng chung để shell không hiện nav trong khi trợ lý ẩn trên cùng một bài thi.",
        "anchorKind": "neo-code",
        "anchor": "D:\\Repositories\\starci-academy-fe\\src\\modules\\learn\\is-live-assessment-route.ts:4-6"
      }
    }
  ]
}
```

**Sai:** viết một danh sách route thứ hai trong layout. Hai danh sách sẽ lệch, và cái lệch đó chỉ lộ
ra khi một người thật đang thi.

---

## `SPINE-5` — chiều rộng thuộc đúng chủ sở hữu

### Ca: "rail bên phải chật quá, nới ra"

```json
{
  "role": "rail",
  "widthOwner": "chinh-vung-nay",
  "widthClass": "w-80",
  "reason": {
    "why": "Chỉ frame sở hữu rail này đổi số; sibling ở trang học giữ nguyên w-72 vì nó là một chủ sở hữu khác và không ai yêu cầu đổi nó.",
    "anchorKind": "neo-tu-choi",
    "anchor": "D:\\Repositories\\starci-academy-backend\\.workflows\\fidel\\starci-academy\\courses-runtime-projection-i18n-20260815-01.md:445",
    "quote": "Live proof phát hiện wrong owner; không để correction lan sang trang học."
  }
}
```

| Founder nói | Đổi cái gì | Không đổi cái gì |
|---|---|---|
| "rail chi tiết khoá học chật" | `main-then-rail` `w-72` → `w-80` | `content-reader-frame` giữ `w-72` |
| "cột learn chật" | `learn-shell-frame` | `main-then-rail` giữ `w-80` |

---

## `SPINE-6` — phân loại route

| Route | Câu hỏi | Phân loại | Kết quả |
|---|---|---|---|
| `[lang]` | Bỏ nó đi thì mất nội dung nào? Không | Cửa vào | Redirect `/dashboard` |
| `learn` | Bỏ nó đi thì mất nội dung nào? Không, `learn/content` mang tất cả | Cửa vào | Redirect `/learn/content`, đích do legacy quyết |
| `learn/flashcards` | Bỏ nó đi thì mất gì? Không | Cửa vào | Redirect `flashcards/review` |
| `learn/mock-interview` | Bỏ nó đi thì mất trang phỏng vấn thử | Mang nội dung | Phải có page owner thật; stub bị cấm |

```json
{
  "owed": [
    {
      "claim": "Route mang nội dung mà chưa có owner thật thì để trống trong kế hoạch, không stub.",
      "reason": {
        "why": "Stub làm route xanh trong khi hành vi sản phẩm sai, nên nó che mất chính việc còn nợ thay vì hoàn thành nó.",
        "anchorKind": "neo-tu-choi",
        "anchor": "D:\\Repositories\\starci-academy-backend\\.workflows\\designs\\starci-academy\\learn-branch.md:495",
        "quote": "Stub làm route “xanh” nhưng sai product behavior và vi phạm parity."
      }
    }
  ]
}
```

### Ca ngược: founder lật, và kế hoạch phải mang theo giá của cú lật

Đầu vào dạng `phan-hoi`:

```json
{
  "kind": "phan-hoi",
  "verdict": "REJECTED",
  "feedbackKind": "lat-lai-phan-quyet-cu",
  "rejected": "Current A+B Today default",
  "chosen": "Legacy `/learn` entry to `/learn/content`",
  "why": "User: “sửa learn để follow legacy”."
}
```

Kế hoạch trả lời cú lật này **phải** liệt kê cái chết theo:

```text
CourseLearnTodayPage      → không route nào mount nữa
isToday                   → không bao giờ true
TODAY_TABS                → nhánh không bao giờ chạy
course-learn-today-page   → contract mồ côi
```

Cú lật không được chấp nhận cho tới khi bốn dòng này có chỗ đi — dọn, hoặc ghi vào `owed`. Bỏ lửng là
cách repo sống hiện đang mang code chết.

---

## `SPINE-7` — tuyên bố có cột mà không có slot

### Sai (đang sống trong repo)

```text
children: { milestone: { leaf: "nav-link", repeats: true }, body: { leaf: "page" } }
classes:  [ "md:flex-row", "md:[&>*:first-child]:w-72" ]
why:      "The milestone run persists beside…"
```

Repeats bị flatMap thành con trực tiếp, nên `md:flex-row` xếp N NavLink ngang hàng với body, và
`*:first-child` nới đúng **một** NavLink.

### Đúng

```text
children: { spine: { contract: "…-column", optional: true }, body: { leaf: "page" } }
classes:  [ "md:flex-row", "md:[&>[data-node=…-column]]:w-72" ]
```

Một slot cho cột, một contract cho cột, và nhắm bằng danh tính của cột.

---

## Ánh xạ yêu cầu sang mã

| Founder gõ | Câu phân định | Mã |
|---|---|---|
| "cho cái sidebar các bài học" | Một quyền mở bao nhiêu mode? | archetype này, `SPINE-1` |
| "cuộn xuống thì mất chỗ đang học" | Cột có tự cuộn không? | `SPINE-1` |
| "trên điện thoại thì sao" | Còn tới được mode nào không? | `SPINE-2`, nav ở mép dưới |
| "lúc thi thì ẩn hết đi" | Ai nữa cũng ẩn theo danh sách này? | `SPINE-3`, predicate dùng chung |
| "cột chật quá" | Founder đang nói về frame nào? | `SPINE-5`, chỉ frame đó |
| "route này chưa có gì, redirect tạm đi" | Bỏ nó thì mất nội dung nào? | `SPINE-6`; mất → cấm redirect |
| "để mấy cái milestone bên trái" | Frame có slot cho cột chưa? | `SPINE-7` |

## Sai lầm lặp lại nhiều nhất

1. Nhắm cột optional bằng `*:first-child`.
2. Ghim mà quên chặn chiều cao.
3. Nuôi danh sách route full-bleed thứ hai trong layout.
4. Nới chiều rộng ở một frame rồi để bản sửa bò sang frame sibling.
5. Redirect một route đang mang nội dung để nó xanh.
6. Chấp nhận cú lật route entry mà không dọn page owner đã mồ côi.
7. Viết `why` hứa một cột mà children không có slot cho cột.
