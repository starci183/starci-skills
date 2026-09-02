# Tone presentation

File này trả lời đúng một câu hỏi: một dòng chữ đã xếp hạng xong thì diễn đạt hạng đó bằng prop tone
công khai nào.

Tone là lựa chọn ngữ nghĩa chứ không phải lựa chọn màu. Ứng dụng chọn dòng đó đáng được chú ý bao
nhiêu, Grammar quy nó về một token. Ứng dụng không bao giờ viết class màu chữ và không ghi đè màu
bên trong một Grammar component khác.

## Thang giá trị

Tập tone công khai là tập đóng, xếp theo mức chú ý mà mỗi bậc đòi hỏi.

| Rule | Prop | Token render ra | Đòi hỏi |
| --- | --- | --- | --- |
| TONE-1 | `tone="default"` | `text-foreground` | Mức chú ý đọc thông thường |
| TONE-2 | `tone="muted"` | `text-muted` | Cố ý thấp hơn dòng bên cạnh |
| TONE-3 | `tone="accent"` | `text-accent-soft-foreground` | Khan hiếm, mỗi lần một đoạn ngắn |

`Text size="xs"` quy về muted bất kể tone được yêu cầu là gì, vì cỡ nhỏ nhất đã là thông tin phụ theo
định nghĩa. `Heading level={4}` mang đúng cách xử lý muted đó. Xin một tone khác ở cỡ này cũng không
nâng nó lên được.

## Owner

Tone thuộc về Grammar. Ô owner gọi tên component nào quy ra token.

| Owner | Nghĩa | Ứng dụng viết |
| --- | --- | --- |
| Tên component | `Text` quy ra tone này | Chỉ truyền prop |
| `—` | Ý nghĩa này chưa có tone công khai | Không viết gì, báo là thiếu |

File này không có owner `App`. Một class màu `text-*` do ứng dụng viết là `APP_OVERRIDE`, và một mã
hex hay giá trị palette thô thì bị từ chối kể cả khi nó trùng token.

Màu trạng thái không phải tone. Thành công, cảnh báo, nguy hiểm và thông tin là những trạng thái ngữ
nghĩa do chính component mang chúng sở hữu, và không bao giờ được diễn đạt bằng cách chọn màu chữ.

## Tone mà Common đã sở hữu

Sinh từ claim của `@grammar/core` bằng `scripts/generate-presentation-owned.mjs`; muốn đổi thì sửa component, đừng sửa bảng này.

| Component | Phần tử hoặc điều kiện | Rule |
| --- | --- | --- |
| `ChatWorkspace` | drawer close, hasRail, isCompactRail | TONE-1 |
| `ChatWorkspace` | rail trigger, hasRail, isCompactRail | TONE-1 |
| `Heading` | root, scale!="display", level=4 | TONE-2 |
| `IconTile` | root, not (isSkeleton || showsArtwork), tone="neutral" | TONE-2 |
| `Input` | button, not (!isSecret || toggleLabel === undefined) | TONE-2 |
| `Sidebar` | group label, group.label!=undefined, not collapsed | TONE-2 |
| `Sidebar` | list box item | TONE-1 |
| `SurfaceAccordionCard` | accordion body | TONE-1 |
| `SurfaceListCard` | fact, not (label === undefined || labelHidden), fact!=undefined | TONE-2 |
| `Text` | root, not isSkeleton, resolvedTone="accent" | TONE-3 |
| `Text` | root, not isSkeleton, resolvedTone="default" | TONE-1 |
| `Text` | root, not isSkeleton, resolvedTone="muted" | TONE-2 |
| `TextAction` | root, appearance="disclosure" | TONE-3 |
| `TextAction` | root, appearance="muted" | TONE-2 |
| `TextAction` | root, appearance="plain" | TONE-1 |
| `TextAction` | root, appearance="route", isCurrent | TONE-3 |
| `TextAction` | root, appearance="route", not isCurrent | TONE-2 |
| `TextAction` | root, appearance="section", isCurrent | TONE-3 |
| `TextAction` | root, appearance="section", not isCurrent | TONE-1 |
| `TextAction` | root, appearance="tab", not isCurrent | TONE-2 |

## TONE-1 — `tone="default"`

Dòng chữ đọc ở mức chú ý thông thường. Đây là tone mặc định khi không truyền gì, trừ ở cỡ nhỏ nhất.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Copy hoặc dữ kiện mà ứng dụng xếp là nội dung đọc thường | `Text` | `<Text tone="default">Enrollment is active.</Text>` |
| Case 2 | Phần thân của một cặp tiêu đề và giải thích mà cả hai đều phải đọc | `Text` | Cả hai dòng giữ default, độ đậm mới là thứ tách chúng |

Không phải rule này: để metadata hạng thấp cạnh tranh với nội dung bên cạnh. Dùng TONE-2.

## TONE-2 — `tone="muted"`

Dòng chữ lùi lại có chủ ý, vì thứ nằm cạnh nó mới mang nghĩa chính.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một dòng bổ nghĩa, đơn vị, hay mốc thời gian gắn với một dữ kiện nêu ngay gần đó | `Text` | `<Text tone="muted">Taxes are calculated at checkout.</Text>` |
| Case 2 | Phần mô tả dưới một tiêu đề, mà tiêu đề mới mang danh tính | `Text` | `<Text size="sm" tone="muted">Ready for junior roles</Text>` |
| Case 3 | Bất kỳ dòng nào ở cỡ nhỏ nhất | `Text` | `size="xs"` đã tự quy về muted |

Không phải rule này: câu duy nhất giải thích một dữ kiện quan trọng, hoặc để giấu bớt phần copy chỉ
vì nó dài. Làm mờ một lời giải thích mà không ai khác nói lại, trên thực tế là gỡ nó khỏi trang.

## TONE-3 — `tone="accent"`

Một đoạn ngắn nổi lên vì ý nghĩa của nó vốn đã đặc biệt trong ngữ cảnh đó.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một nhãn ngắn duy nhất mà ứng dụng đã quyết định là cần nhấn | `Text` | `<Text tone="accent" weight="semibold">Recommended</Text>` |

Không phải rule này: cả đoạn văn, các phần tử ngang hàng lặp lại, hay trang trí. Accent lặp trên
nhiều phần tử ngang hàng thì thôi đánh dấu được gì. Accent cũng không bao giờ mang nghĩa một mình,
vì không phải người đọc nào cũng đọc được màu.

## Tương phản

Token tone được định nghĩa so với chính surface mà nó nằm lên. Một tone chọn trên surface này rồi
render trên surface khác là một phát hiện về tương phản chứ không phải chuyện thẩm mỹ, và nó được đo
so với nền thật sự đang chồng lên chứ không phải nền dự định.

Khi tương phản không đạt thì ứng dụng đổi surface, không bao giờ đổi token.

## File này không quyết định

Dòng chữ được đặt to hay đậm cỡ nào thuộc về [Font](font.md). Nó nằm trên surface nào, và màu ngữ
nghĩa của surface đó, thì nằm hoàn toàn ngoài phạm vi presentation.
