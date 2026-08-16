---
id: fe-layouts-cot-dich-den-dung-canh-than-trang-audit
title: audit.md
slug: /fe/layouts/cot-dich-den-dung-canh-than-trang/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định của luật cột đích đến, và hai vi phạm cấu trúc còn sống.
---

# audit.md

> Phiên bản: `1.00` · Mô-đun: `cot-dich-den-dung-canh-than-trang`

Phản biện này kiểm xem luật có chọn được đúng một mã từ **quyền truy cập, số mode và vai trò của
route**, và chỉ từ đó.

## Kết luận

Chấp nhận, kèm một cảnh báo nặng: archetype này có **hai thành viên không cùng chất lượng**, và mô-đun
phải nói ra điều đó chứ không được lấy trung bình.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| Cột đích đến so với cột danh tính | Loại trừ được: cột này chứa **nơi để đi**, cột kia chứa **một người**. Xem mô-đun `khung-danh-tinh-bao-quanh-bang-chung` |
| `SPINE-1` có áp không | Loại trừ được khi đã nêu cột có tràn hay không |
| `SPINE-2` nav so với action bar | Loại trừ được bằng **nội dung** bên trong, không bằng hình dáng |
| `SPINE-3` | Loại trừ được khi đã nêu route có phải một bài đánh giá đang diễn ra |
| `SPINE-4` | Loại trừ được khi đã nêu cột có optional hay không |
| `SPINE-5` | Loại trừ được khi đã nêu founder đang nói về frame nào |
| `SPINE-6` | Loại trừ được bằng đúng một câu hỏi: bỏ route này thì có nội dung nào không còn tồn tại ở đâu khác không |
| `SPINE-7` | Loại trừ được bằng cấu trúc children, không bằng lời trong `why` |

## Nhận định

- **`SPINE-6` là mã dễ đọc sai nhất của cả shelf.** Hai phán quyết ngược chiều nằm ở hai record khác
  nhau, cách nhau vài ngày. Ai đọc trúng một cái sẽ ra một luật sai theo đúng hai kiểu ngược nhau:
  hoặc cấm mọi redirect, hoặc coi redirect là giải pháp cho route chưa làm.
- **Cú lật `SPINE-6` để lại rác, và rác đó là bằng chứng rằng luật cần vế "mang theo giá".** Không
  phán quyết nào nói "dọn `CourseLearnTodayPage`", nên không ai dọn.
- **`SPINE-4` có hai lý do độc lập** — cột optional, và sibling ẩn do vendor chèn — cùng dẫn tới một
  kết luận. Một luật có hai lý do rời nhau thì bền hơn một luật có một.
- **`SPINE-3` là chỗ duy nhất trong shelf mà một hàm là một luật.** Predicate dùng chung không phải
  gọn gàng kỹ thuật; nó là điều kiện để hai chủ sở hữu không mâu thuẫn trên cùng một màn hình.

## Vi phạm còn sống

| Vi phạm | Bằng chứng | Mức |
|---|---|---|
| `personal-project-workspace-frame` không có vùng rail | `contracts\index.ts:392` (`milestone` là leaf `repeats: true`, con trực tiếp), `:388` (`md:[&>*:first-child]:w-72`), `Tree\index.tsx:40-61` (`ContractContent` flatMap repeats không bọc). `why` ở `:395` tuyên bố "The milestone run persists beside…" | Cấu trúc không đỡ nổi lời tuyên bố. Một thành viên của archetype này **không thật sự có cột** |
| Code chết còn lại sau cú lật route entry | `CourseLearnTodayPage\` còn tồn tại, grep toàn `src/` ngoài chính folder đó ra 0 kết quả; `LearnShellLayout\index.tsx:128` `isToday` không bao giờ true; `TODAY_TABS` ở `:95-99`, `:158` không bao giờ chạy; contract `course-learn-today-page` ở `contracts\index.ts:289` mồ côi | Không sai hành vi, nhưng nó là bằng chứng rằng cú lật đã được nhận mà không mang theo giá |
| Ba chỗ còn nhắm bằng vị trí | `personal-project-workspace-frame` `contracts\index.ts:388-389`; `content-reader-frame` `:1951-1959`; `main-then-rail` `:2233-2236` | Neo từ chối đã có từ trước ba chỗ này |

**Giới hạn của bằng chứng.** Vi phạm thứ nhất suy ra từ `ContractContent` flatMap cộng selector
positional, **chưa render để xem thật**. Test hiện có (`component.test.tsx`) chỉ assert sự HIỆN DIỆN
của text, không assert cấu trúc vùng — nên nó không phải bằng chứng phản bác.

## Quyết định

- Giữ bảy mã.
- `SPINE-6` viết thành **tiêu chí**, giữ đủ cả hai phán quyết trong `INDEX.md`, và thêm nghĩa vụ liệt
  kê cái chết theo khi nhận một cú lật.
- Nói thẳng trong `## Scope` rằng hai thành viên không cùng chất lượng, thay vì mô tả archetype bằng
  thành viên tốt hơn.
- `SPINE-7` là một mã tình huống chứ không phải một dòng trong `audit`, vì nó sẽ tái diễn ở frame
  tiếp theo có run lặp.

## Rủi ro còn mở

- **`SPINE-7` có thể không phải defect mà là một hình dạng thứ hai hợp lệ** — một hàng milestone chạy
  ngang thay vì một cột đứng. Không phán quyết nào nói về nó. Nếu founder chọn hàng ngang thì `why`
  phải đổi, không phải cấu trúc.
- **Chưa xác minh `md:` của repo này bằng bao nhiêu px.** Mọi câu về hành vi hẹp đọc từ chuỗi class.
- **`SPINE-5` mới có hai con số.** Con số thứ ba sẽ cho biết `w-72`/`w-80` là hai quyết định độc lập
  hay một thang đang hình thành.

## Điều kiện phản biện lại

- Một frame thứ ba gia nhập archetype.
- Founder phán quyết về hàng milestone ngang so với cột đứng.
- Có render thật chứng minh hoặc bác bỏ vi phạm `personal-project-workspace-frame`.
- Ba chỗ positional được sửa, hoặc được phán quyết là giữ.
- `CourseLearnTodayPage` được dọn hoặc được mount lại.
