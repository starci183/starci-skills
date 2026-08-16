---
id: fe-layouts-archetypes-invisible-owner-example
title: example.md
slug: /fe/layouts/archetypes/invisible-owner/example
sidebar_label: example.md
sidebar_position: 2
description: Từng ca của mọi mã KEEPER-N, gồm cả bảng chọn chỗ mount và chính sách reset.
---

# example.md

> Phiên bản: `1.00` · Mô-đun: `invisible-owner` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mảnh `LayoutPlan` dưới đây viết đúng theo [`../gate.schema.json`](../../gate.schema.json).

---

## `KEEPER-1` — chọn chỗ mount

### Ca: "làm trợ lý AI, đi trang nào cũng hỏi tiếp được"

Câu phân định: cái gì không được chết? Hội thoại đang mở. Nó phải sống qua ranh giới cụm route nào?
Tất cả. → gốc locale.

```json
{
  "pageId": "global-ai-owner",
  "archetype": "invisible-owner",
  "archetypeReason": {
    "why": "Layout này không vẽ khung; nó tồn tại để hội thoại đang mở sống sót khi mặt trang bị thay, nên mặt trang và người giữ là anh em chứ không lồng nhau.",
    "anchorKind": "neo-code",
    "anchor": "D:\\Repositories\\starci-academy-fe\\src\\components\\contracts\\index.ts:2722"
  },
  "routeCluster": "locale-root",
  "frameContract": "global-ai-layout",
  "reusesLayout": "GlobalAiChatLayout",
  "shell": "RouteShell",
  "opensMainLandmark": false,
  "mainLandmarkReason": {
    "why": "Người giữ không mở landmark nào vì nó không vẽ vùng nào; mọi landmark thuộc về cụm route và route file bên dưới.",
    "anchorKind": "neo-code",
    "anchor": "D:\\Repositories\\starci-academy-fe\\src\\components\\contracts\\index.ts:2715"
  },
  "regions": [
    {
      "role": "surface",
      "host": "div",
      "persistence": "ve-lai-theo-route",
      "narrowBehaviour": "khong-doi",
      "narrowMeasure": "khong-do",
      "selector": "khong-dung-selector",
      "stickyOffsetToken": "khong-sticky",
      "maxHeightToken": "khong-gioi-han",
      "ownsScroll": false,
      "reason": {
        "why": "Mặt trang được thay tự do vì thứ phải sống sót không nằm trong nó mà nằm trong hook của layout.",
        "anchorKind": "neo-code",
        "anchor": "D:\\Repositories\\starci-academy-fe\\src\\components\\layouts\\GlobalAiChatLayout\\index.tsx:32-34"
      }
    },
    {
      "role": "trigger",
      "host": "div",
      "optional": true,
      "persistence": "dung-yen-du-lieu",
      "narrowBehaviour": "khong-doi",
      "narrowMeasure": "khong-do",
      "selector": "khong-dung-selector",
      "reason": {
        "why": "Nút mở là hành tinh rời chứ không phải vùng: mặt trang không phải nhường một pixel nào cho nó.",
        "anchorKind": "neo-code",
        "anchor": "D:\\Repositories\\starci-academy-fe\\src\\components\\contracts\\index.ts:2719"
      }
    },
    {
      "role": "drawer",
      "host": "div",
      "optional": true,
      "persistence": "dung-yen-du-lieu",
      "narrowBehaviour": "khong-doi",
      "narrowMeasure": "khong-do",
      "selector": "khong-dung-selector",
      "reason": {
        "why": "Ngăn kéo do chính người giữ mount nên panel sống lâu hơn route dưới nó, đúng như điều khiển mở nó.",
        "anchorKind": "neo-code",
        "anchor": "D:\\Repositories\\starci-academy-fe\\src\\components\\layouts\\GlobalAiChatLayout\\index.tsx:77"
      }
    }
  ]
}
```

### Bảng chọn chỗ mount

| Thứ phải sống sót | Sống qua cái gì | Mount ở | Vì sao không mount thấp hơn |
|---|---|---|---|
| Hội thoại AI | Mọi cụm route | `src\app\[lang]\layout.tsx` | Chrome lặp theo cụm sẽ làm rơi hội thoại khi qua ranh giới cụm |
| Socket + phiên playground | Các màn trong một slug | `playground\[slug]\layout.tsx` | Socket của một slug không có lý do sống lâu hơn slug |
| Giỏ hàng đang mở | Các route trong một cụm | layout của cụm | Đúng phạm vi, không rộng hơn |

### Sai, và vì sao

```text
mount trong AppProviders     → đã bị bác: provider sở hữu context, không sở hữu bố cục thị giác
mount trong ShellNav         → đã bị bác: lặp theo cụm, rơi state khi qua ranh giới cụm
mount trong từng page        → một focus trap mỗi trang, và state chết mỗi lần điều hướng
```

---

## `KEEPER-4` + `KEEPER-7` — người giữ phạm vi một cụm

```json
{
  "pageId": "playground-session",
  "archetype": "invisible-owner",
  "routeCluster": "courses",
  "frameContract": "playground-session-frame",
  "reusesLayout": "PlaygroundSessionLayout",
  "opensMainLandmark": false,
  "regions": [
    {
      "role": "surface",
      "host": "div",
      "optional": true,
      "persistence": "dung-yen-du-lieu",
      "narrowBehaviour": "khong-doi",
      "narrowMeasure": "khong-do",
      "selector": "khong-dung-selector",
      "ownsScroll": false,
      "reason": {
        "why": "Cái đứng yên ở đây là socket và phiên chứ không phải pixel, nên chuyển từ setup sang session không dựng lại kết nối.",
        "anchorKind": "neo-code",
        "anchor": "D:\\Repositories\\starci-academy-fe\\src\\components\\layouts\\PlaygroundSessionLayout\\index.tsx:52-53"
      }
    },
    {
      "role": "notice",
      "host": "div",
      "optional": true,
      "persistence": "ve-lai-theo-route",
      "narrowBehaviour": "khong-doi",
      "narrowMeasure": "khong-do",
      "selector": "khong-dung-selector",
      "reason": {
        "why": "Notice thay hẳn mặt trang chứ không đứng cạnh nó, vì nếu thứ phải sống sót không tải được thì mặt trang đang vẽ một phiên không tồn tại.",
        "anchorKind": "neo-code",
        "anchor": "D:\\Repositories\\starci-academy-fe\\src\\components\\layouts\\PlaygroundSessionLayout\\component.tsx:23-33"
      }
    }
  ],
  "states": [
    { "state": "ready", "branch": "co-nhanh-rieng", "chromeKept": "giu-du-chrome", "reason": { "why": "Không có chrome nào để giữ, nên trạng thái sẵn sàng chỉ là mặt trang nằm trong một frame trống trơn.", "anchorKind": "neo-code", "anchor": "D:\\Repositories\\starci-academy-fe\\src\\components\\contracts\\index.ts:465" } },
    { "state": "failed", "branch": "co-nhanh-rieng", "chromeKept": "vut-het-chrome", "reason": { "why": "Chỉ một lần tải hỏng mới thay mặt trang, và hai slot loại trừ nhau nên không có trạng thái nào vẽ cả hai.", "anchorKind": "neo-code", "anchor": "D:\\Repositories\\starci-academy-fe\\src\\components\\contracts\\index.ts:470" } }
  ]
}
```

**Chú ý `"narrowBehaviour": "khong-doi"` ở mọi vùng.** `playground-session-frame` không có một
breakpoint nào. Khai một hành vi hẹp mà nguồn không có là bịa.

---

## `KEEPER-5` — chính sách reset, viết thành bảng

| State | Reset theo điều hướng? | Khoá theo | Vì sao |
|---|---|---|---|
| Hội thoại đang mở | không | — | Đây chính là thứ người giữ tồn tại để giữ |
| Trạng thái mở/đóng của drawer | không | — | Đóng nó khi đổi trang là tự huỷ mục đích |
| Bộ đếm tangent | không | — | Thuộc về phiên, không thuộc về trang |
| Ngữ cảnh code | **có** | đường dẫn neo | Đoạn code đang chọn thuộc về đúng file đang mở |

```json
{
  "owed": [
    {
      "claim": "Mọi state của người giữ đều đã phân loại reset hay không, và cái reset thì khoá theo đúng thứ làm nó đổi.",
      "reason": {
        "why": "Chỉ ngữ cảnh code phụ thuộc route nên chỉ nó reset, còn reset cả cụm sẽ xoá đúng lý do người giữ tồn tại.",
        "anchorKind": "neo-code",
        "anchor": "D:\\Repositories\\starci-academy-fe\\src\\components\\layouts\\GlobalAiChatLayout\\index.tsx:36-38"
      }
    }
  ]
}
```

---

## `KEEPER-6` — một predicate, hai chủ sở hữu

```text
isLiveAssessmentRoute(path)
   ├── LearnShellLayout  → bỏ cột, full-bleed
   └── isContentAiRouteHidden → ẩn trợ lý
```

| Sai | Hậu quả |
|---|---|
| Layout tự nuôi danh sách route | Shell hiện nav trong khi trợ lý ẩn, trên cùng một bài thi |
| Copy danh sách sang module AI | Hai danh sách lệch nhau sau lần thêm route thứ nhất |
| Thêm trang kết quả vào danh sách | Ẩn nhầm: tương tác trực tiếp đã kết thúc ở đó |

---

## `KEEPER-3` — không biến trục thành tab

| Yêu cầu | Trả lời | Neo |
|---|---|---|
| "Thêm tab AI vào cạnh Bài đọc / Source / Challenge" | Không. Trợ lý toàn cục và mặt nội dung là hai trục khác nhau | "Global assistant and lesson content face are different axes." |
| "Cho luồng global hiểu trang đang mở luôn" | Không hứa. Luồng global cố ý không neo vào trang nào | "Backend `global` is intentionally anchorless." |

---

## Ánh xạ yêu cầu sang mã

| Founder gõ | Câu phân định | Mã |
|---|---|---|
| "đi trang nào cũng hỏi tiếp được" | Cái gì không được chết? | `KEEPER-1`, gốc locale |
| "để nó trong provider cho gọn" | Provider sở hữu gì? | `KEEPER-1`, từ chối |
| "thêm tab AI vào bài học" | Đây là trục hay là mặt? | `KEEPER-3`, từ chối |
| "chuyển màn mà đừng mất kết nối" | Đứng yên là pixel hay dữ liệu? | `KEEPER-4`, dữ liệu |
| "đổi bài thì quên đoạn code cũ đi" | Phần nào phụ thuộc route? | `KEEPER-5`, reset hẹp |
| "lúc thi thì đừng hiện" | Ai nữa cũng ẩn theo danh sách này? | `KEEPER-6`, predicate dùng chung |
| "lỗi thì hiện gì" | Notice thay hay đứng cạnh? | `KEEPER-7`, thay |

## Sai lầm lặp lại nhiều nhất

1. Mount người giữ vào cây provider vì "chỗ đó bọc tất cả".
2. Mount vào chrome của cụm route rồi mất state khi qua cụm.
3. Khai `dung-yen-pixel` cho một archetype mà cái đứng yên là dữ liệu.
4. Reset cả cụm state khi đổi route.
5. Nuôi danh sách route ẩn thứ hai.
6. Vẽ notice **cạnh** mặt trang thay vì **thay** nó.
7. Khai hành vi hẹp cho một frame không có breakpoint nào.
