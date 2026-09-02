# Đề xuất — một composite cho cặp "tiêu đề + dòng phụ" lặp lại

Trạng thái: chỉ là đề xuất, ngày 2026-09-02. Chưa có gì được hiện thực. Chủ quyết định.

## Bằng chứng

Đếm bên trong các container do app sở hữu của ba vùng được phép (starci `blocks/dashboard/*`,
`blocks/commerce/ProSubscriptionBlock`, nivo `blocks/auth/AuthenticationPanel` và trang authentication),
mỗi lần một container, hai hoặc ba lá Grammar trong container đó:

| Hình dạng | Số lần | Ở đâu |
| --- | --- | --- |
| `Text size="sm" weight="semibold"` rồi `Text size="xs" tone="muted"` | 2 | dashboard, commerce |
| `Heading` rồi `Text size="sm" tone="muted"` | 2 | auth |
| `Heading` rồi `Text tone="muted"` | 1 | commerce |
| `Text size="sm" weight="normal"` rồi `Text size="xs" tone="muted"` | 1 | dashboard |
| `Text size="xs" tone="muted"` đứng trên `Text size="md" weight="semibold"` (định ngữ trước) | 1 | dashboard `ContinueLearning` |
| `SurfaceCopyGroup` bọc `Text weight="semibold"` + `Text size="sm" tone="muted"` | 1 | commerce |

Tám lần của cùng một quan hệ: một dòng tiêu đề và một dòng phụ ở `TONE-2`, xếp dọc với `GAP-1` hoặc
`GAP-2`. Bảy trong tám được dựng tay bằng một `div` do app sở hữu. Knowledge đã gọi tên khoảng trống:
`gap.md` GAP-1 Case 1 và Case 2 mang owner `—` ("Common không có đường công khai"), và lần chạy khô
`fe.presentation.resolve` trên `ContinueLearning` dừng `RULE_MISSING` đúng ở cặp này.

## Đề xuất

Không thêm leaf. `SurfaceCopyGroup` đã tồn tại cho đúng quan hệ này, đang được dùng một chỗ, và hôm nay
nhận children tự do cùng `density` là `compact` (`.5rem`) hay `comfortable` (`.75rem`). Biến nó thành
chủ sở hữu:

- Slot thay cho children: `title` (bắt buộc), `description` (tuỳ chọn), `eyebrow` (tuỳ chọn, định ngữ
  đứng trên tiêu đề). Chỉ shell mới lộ `children`; composite chiếu slot có kiểu.
- `density`: thêm `tight` (`.25rem`, GAP-1) cạnh `compact` (GAP-2) và `comfortable` (GAP-3).
- Typography cố định theo slot, lấy từ thang font và tone: `eyebrow` = `Text size="xs"` (FONT-1, tự về
  TONE-2); `description` = `Text size="sm" tone="muted"` (FONT-2, TONE-2) hoặc `size="xs"` khi
  `density="tight"`; `title` = `Text size="sm" weight="semibold"` (FONT-2) mặc định, hoặc một `Heading`
  ở cấp đã cho khi tiêu đề là cấu trúc tài liệu (`heading={2|3}`).
- `isSkeleton` truyền xuống mọi slot.

Thay đổi knowledge kéo theo, không có luật mới: `gap.md` GAP-1 Case 1 và 2 owner `—` →
`SurfaceCopyGroup density="tight"`; dòng "Gap mà Common đã sở hữu" thêm `.25rem` → GAP-1; `font.md` và
`tone.md` "Common đã sở hữu" gọi tên ba slot. Lần chạy khô `ContinueLearning` khi đó resolve cặp danh
tính về `owner: grammar`.

## Điều này không quyết

- Chồng "dòng phụ + hành động" (`Text muted` rồi `TextAction`/`Button`) xuất hiện hai lần (auth,
  dashboard). Hai lần chưa phải pattern; vẫn thuộc app.
- `IconTile` dẫn đầu cạnh khối chữ xuất hiện một lần. Tương tự.
- Việc dời tám chỗ gọi (sáu ở starci, hai ở nivo) là bước "áp lên app" và đi qua
  `fe.presentation.resolve` → `fe.source.apply`, không làm tay.

## Chi phí và rủi ro

Một component, một bậc density trong CSS, một spec, hai bảng knowledge, tám chỗ gọi. Rủi ro là một tiêu
đề về ngữ nghĩa là heading lại bị render thành `Text`; prop `heading` có sẵn cho việc đó, và luật A11Y
của audit bắt được cấp outline bị thiếu.
