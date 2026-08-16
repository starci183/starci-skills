---
id: fe-layouts-khung-danh-tinh-bao-quanh-bang-chung-example
title: example.md
slug: /fe/layouts/khung-danh-tinh-bao-quanh-bang-chung/example
sidebar_label: example.md
sidebar_position: 2
description: Từng ca của mọi mã IDENT-N, gồm cả ma trận trạng thái viết đủ năm nhánh.
---

# example.md

> Phiên bản: `1.00` · Mô-đun: `khung-danh-tinh-bao-quanh-bang-chung` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mảnh `LayoutPlan` dưới đây viết đúng theo [`../gate.schema.json`](../gate.schema.json).

---

## `IDENT-1` + `IDENT-2` — cột danh tính và cách nó gập

### Ca: "trang hồ sơ công khai, xem được dự án và CV của người ta"

Câu phân định: trang nói về **một người**, và vùng chính đổi giữa các mặt bằng chứng về chính người
đó. → archetype này, không phải cột đích đến.

```json
{
  "pageId": "public-profile-overview",
  "archetype": "khung-danh-tinh-bao-quanh-bang-chung",
  "archetypeReason": {
    "why": "Cột bên giữ một con người chứ không giữ danh sách nơi để đi, và vùng chính đổi giữa các mặt bằng chứng về đúng người đó.",
    "anchorKind": "neo-code",
    "anchor": "D:\\Repositories\\starci-academy-fe\\src\\components\\contracts\\index.ts:810"
  },
  "routeCluster": "profile",
  "frameContract": "profile-tabs-over-body",
  "reusesLayout": "PublicProfileLayout",
  "opensMainLandmark": false,
  "regions": [
    {
      "role": "bottom",
      "host": "nav",
      "persistence": "dung-yen-pixel",
      "narrowBehaviour": "khong-doi",
      "narrowMeasure": "khong-do",
      "selector": "khong-dung-selector",
      "reason": {
        "why": "Tab strip đổi vùng bằng chứng đang hiển thị nên nó chạy hết chiều ngang, và nó thuộc layout hồ sơ chứ không phải một tầng thứ hai do navbar toàn cục sở hữu.",
        "anchorKind": "neo-code",
        "anchor": "D:\\Repositories\\starci-academy-fe\\src\\components\\contracts\\index.ts:788"
      }
    },
    {
      "role": "rail",
      "host": "aside",
      "persistence": "dung-yen-pixel",
      "narrowBehaviour": "nhay-len-tren-main",
      "narrowMeasure": "container-query-cua-chinh-vung",
      "widthOwner": "chinh-vung-nay",
      "widthClass": "@app-md:w-72",
      "selector": "khong-dung-selector",
      "stickyOffsetToken": "khong-sticky",
      "maxHeightToken": "khong-gioi-han",
      "ownsScroll": false,
      "reason": {
        "why": "Danh tính giữ một bề rộng đọc ổn định cạnh bằng chứng co giãn, rồi đi TRƯỚC bằng chứng khi hẹp, nên ngữ cảnh không bao giờ mất và cũng không bị bóp vào một cột card thứ hai.",
        "anchorKind": "neo-code",
        "anchor": "D:\\Repositories\\starci-academy-fe\\src\\components\\contracts\\index.ts:810"
      }
    },
    {
      "role": "main",
      "host": "section",
      "persistence": "ve-lai-theo-route",
      "narrowBehaviour": "khong-doi",
      "narrowMeasure": "container-query-cua-chinh-vung",
      "selector": "khong-dung-selector",
      "reason": {
        "why": "Chỉ vùng bằng chứng vẽ lại khi đổi mặt, và nó co giãn để cột danh tính không phải nhường bề rộng đọc của mình.",
        "anchorKind": "neo-code",
        "anchor": "D:\\Repositories\\starci-academy-fe\\src\\components\\contracts\\index.ts:805"
      }
    }
  ]
}
```

**Chú ý `"narrowMeasure": "container-query-cua-chinh-vung"`.** Đây là archetype duy nhất khai giá trị
này. Khai `viewport-md` ở đây là đổi câu hỏi từ "vùng này có đủ chỗ không" sang "màn hình rộng bao
nhiêu", rồi hy vọng hai câu trùng nhau.

---

## `IDENT-5` — ma trận trạng thái, viết đủ năm nhánh

```json
{
  "states": [
    { "state": "ready", "branch": "co-nhanh-rieng", "chromeKept": "giu-du-chrome", "reason": { "why": "Chủ thể có thật và các mặt bằng chứng mở được, nên khung vẽ đủ tab strip, cột và vùng chính.", "anchorKind": "neo-code", "anchor": "D:\\Repositories\\starci-academy-fe\\src\\components\\layouts\\PublicProfileLayout\\component.tsx:101" } },
    { "state": "locked", "branch": "co-nhanh-rieng", "chromeKept": "giu-rail-bo-tab-strip", "reason": { "why": "Người đó có thật nên cột danh tính ở lại, còn tab strip bị bỏ vì một control trỏ vào mặt không mở được là một control nói dối.", "anchorKind": "neo-code", "anchor": "D:\\Repositories\\starci-academy-fe\\src\\components\\layouts\\PublicProfileLayout\\component.tsx:70" } },
    { "state": "not-found", "branch": "co-nhanh-rieng", "chromeKept": "vut-het-chrome", "reason": { "why": "Không có chủ thể thì không có gì để nhận diện, nên khung tự thay bằng đúng một notice ở giữa thay vì vẽ phiên bản rỗng của chính nó.", "anchorKind": "neo-code", "anchor": "D:\\Repositories\\starci-academy-fe\\src\\components\\layouts\\PublicProfileLayout\\component.tsx:54" } },
    { "state": "failed", "branch": "co-nhanh-rieng", "chromeKept": "vut-het-chrome", "reason": { "why": "Chủ thể có thể có thật nhưng không lấy được, nên màn hình nói đúng một điều đó và kèm lối thử lại.", "anchorKind": "neo-code", "anchor": "D:\\Repositories\\starci-academy-fe\\src\\components\\layouts\\PublicProfileLayout\\component.tsx:38" } },
    { "state": "loading", "branch": "roi-xuong-cay-ready", "chromeKept": "giu-du-chrome", "reason": { "why": "Nửa connected vẫn tính ra trạng thái này thật, nhưng nửa pure không có nhánh cho nó nên nó vẽ cây ready lên dữ liệu chưa tới.", "anchorKind": "neo-code", "anchor": "D:\\Repositories\\starci-academy-fe\\src\\components\\layouts\\PublicProfileLayout\\index.tsx:43-44" } }
  ]
}
```

Dòng cuối là **khai một vi phạm**, không phải khai một thiết kế. Kế hoạch mới cho một khung tương tự
phải khai `"branch": "co-nhanh-rieng"` cho cả năm.

### Sai, và vì sao

```text
union 5 state, if 4 nhánh                  → state thứ 5 vẽ cây của state khác
locked giữ cả tab strip                    → control trỏ vào mặt không mở được
not-found giữ cột                          → nhận diện một người không tồn tại
loading vẽ skeleton trong cây ready mà không khai  → ma trận trạng thái nói dối về độ phủ
```

---

## `IDENT-3` — mỗi dữ kiện thuộc đúng một vùng

| Dữ kiện | Vùng sở hữu | Vùng KHÔNG được vẽ nó | Vì sao |
|---|---|---|---|
| Tên, ảnh, handle | cột | vùng chính | Cột trả lời "đây là ai" |
| Tiêu đề của một mục | danh sách | panel | Danh sách giữ danh tính |
| Mô tả đầy đủ của mục | panel | danh sách | Panel giữ mô tả |
| Trạng thái/loại của mục | danh sách | panel | Nó là một phần của danh tính dòng |
| CTA mở route | panel | danh sách | Click ở danh sách để đọc detail, không để điều hướng |

```json
{
  "id": "evidence-detail",
  "region": "main",
  "order": 1,
  "renderForm": "o-bang-chung-ho-so",
  "reason": {
    "why": "Mô tả thuộc panel chứ không thuộc danh sách, vì danh sách chỉ giữ danh tính của từng dòng và hai vùng không mượn việc của nhau.",
    "anchorKind": "neo-tu-choi",
    "anchor": "D:\\Repositories\\starci-academy-backend\\.workflows\\fidel\\starci-academy\\global-search-modal-spacing-listbox-20260815-01.md:466",
    "quote": "không render briefs ở list nhưng ở bên phải phải có details"
  }
}
```

---

## `IDENT-4` — tab là route thật

```json
{
  "id": "profile-faces",
  "region": "bottom",
  "order": 0,
  "renderForm": "cua-vao-toan-cuc",
  "reason": {
    "why": "Mỗi mặt bằng chứng có địa chỉ riêng chia sẻ được nên điều khiển đổi mặt thật sự là điều hướng và nó push route, trong khi breadcrumb vẫn giữ tổ tiên route.",
    "anchorKind": "neo-code",
    "anchor": "D:\\Repositories\\starci-academy-fe\\src\\components\\layouts\\PublicProfileLayout\\index.tsx:75"
  }
}
```

| Trang | Tab làm gì | Vì sao khác nhau |
|---|---|---|
| Hồ sơ công khai | `router.push` | Mỗi mặt là một route thật |
| Chi tiết khoá học | `useState` | Bốn mục của cùng một tài liệu, một route |
| Bảng điều khiển | `router.replace("?tab=")` | Ghi query, chủ sở hữu route không đổi |
| Learn trên mobile | `setMobileView` | State cục bộ, đã bị bác nếu làm bằng route link |

---

## `IDENT-6` — bốn lớp, thử gộp thì hỏng ở đâu

```text
measure     max-w-app-xl, mx-auto      ← chặn bề rộng đọc
  inset     p-6                        ← đệm BÊN TRONG cái chặn
    container  @container              ← lập container query
      split    flex-col @app-md:flex-row   ← xếp cột và vùng chính
```

| Gộp thử | Hỏng ở đâu |
|---|---|
| inset vào measure | Padding ra ngoài cái chặn; container query quan sát nhầm bề rộng |
| container vào split | Query đo cây con của split chứ không đo vùng |
| bỏ measure | Hồ sơ thừa hưởng cap hẹp của bảng điều khiển thay vì giữ measure của chính nó |

---

## Ánh xạ yêu cầu sang mã

| Founder gõ | Câu phân định | Mã |
|---|---|---|
| "làm trang hồ sơ công khai" | Trang nói về ai? | archetype này, `IDENT-1` |
| "trên điện thoại thì cái hero đi đâu" | Nó biến mất hay đi lên trên? | `IDENT-2`, lên trên |
| "cho hiện mô tả ở danh sách luôn cho tiện" | Panel còn việc gì? | `IDENT-3`, từ chối |
| "tab hồ sơ share link được không" | Mỗi mặt có địa chỉ riêng? | `IDENT-4`, push |
| "chưa có dữ liệu thì hiện gì" | State này có nhánh chưa? | `IDENT-5` |
| "sao phải bốn div lồng nhau" | Gộp thì cái nào hỏng? | `IDENT-6` |

## Sai lầm lặp lại nhiều nhất

1. Nhầm cột danh tính thành cột điều hướng, rồi nhét menu vào đó.
2. Đo gập bằng viewport thay vì container query của chính vùng.
3. Khai union năm trạng thái mà chỉ viết bốn nhánh.
4. Cho `locked` giữ nguyên tab strip.
5. Cho danh sách gánh mô tả của panel.
6. Làm phẳng bốn lớp bọc vì trông thừa.
7. Dùng `*:first-child` để nới cột.
