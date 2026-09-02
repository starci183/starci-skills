# Feedback composition

File này trả lời đúng một câu hỏi: khi có thứ gì đó hỏng, thành công, hoặc cần sửa, ai là người
thông báo, và owner đó nhỏ tới đâu.

Feedback được chốt ở chỗ nhỏ nhất mà thật sự sửa hoặc phục hồi được. Một lỗi báo ở nơi xa hơn chỗ có
thể sửa nó sẽ bắt người đọc đi tìm nguyên nhân, còn một lối phục hồi ở tầm cả trang cho một panel
hỏng sẽ ném đi cả phần công việc chưa từng hỏng.

## FEEDBACK-1 — Sửa ở owner gần nhất

Chi phối chỗ ở của một lỗi validation.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Một field đang có lỗi validation mà người đọc sửa được ngay tại field đó | `Input.errorMessage` trên chính field đó mang cả lỗi lẫn cách sửa, và `isError` gắn vào đúng dữ kiện không hợp lệ ấy |
| Case 2 | Field có phần hướng dẫn thường trực, đúng dù nó có lỗi hay không | Phần hướng dẫn đó nằm trong `hint`, và nó không xuất hiện rồi biến mất theo validation |
| Case 3 | Cùng lỗi đó còn được tóm tắt lại ở phía trên form | Đúng một owner nêu lỗi đó, và owner ấy là field |
| Case 4 | Thông điệp là điều hướng hoặc trạng thái chung chứ không phải một giá trị bị từ chối | Không carrier validation nào giữ nó; nó phân giải về một owner status ở chỗ khác |
| Case 5 | Giá trị thay đổi, hoặc validation chạy lại | Lỗi được cập nhật hoặc gỡ đi theo dữ kiện, và phần người đọc đã nhập còn nguyên |

## FEEDBACK-2 — Phục hồi ở owner hành động nhỏ nhất

Chi phối chỗ ở của một nút thử lại.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Một vùng rỗng hoặc vùng lỗi có một bước kế tiếp thật | `EmptyNotice` gọi tên đúng vùng bị ảnh hưởng và mang `actionLabel` cùng `onAction` cho bước đó, `description` là tuỳ chọn |
| Case 2 | Action phục hồi đã nhận việc | `isActionPending` được gắn trong lúc action đó chạy, và không gắn cho action nào khác |
| Case 3 | Nối một nút tải lại cả trang thì dễ hơn | Lối phục hồi được giới hạn đúng vào thao tác đã hỏng; không nút tải lại cả trang nào đứng thay cho một vùng hỏng |
| Case 4 | Lặp lại thao tác là không an toàn, như với một giao dịch mua | Lối phục hồi là một thao tác an toàn riêng biệt có authority chống lưng, không phải lần lặp lại thao tác không an toàn |
| Case 5 | Người đọc còn công việc chưa lưu ở chỗ khác trên trang | Chỉ vùng đã hỏng bị thay, và phần việc ngoài nó sống sót qua lần phục hồi |

## FEEDBACK-3 — Phải biết việc đã kết thúc rồi mới được nói

Chi phối thời điểm được phép nêu một kết quả.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Một câu lệnh đang chờ kết quả | Pending chỉ gỡ khi có một kết thúc thật, và copy kết quả gọi tên đúng kết cục đã về |
| Case 2 | Một kết quả không khẩn cần được đọc lên | `Text live="polite"` nằm trên owner nhỏ nhất của status đó |
| Case 3 | Thông điệp thật sự khẩn và việc cắt ngang là chính đáng | `live="assertive"` chỉ được gắn ở đó, và không gắn ở đâu khác trong cây |
| Case 4 | Cùng một kết quả sẽ xuất hiện ở hai chỗ | Đúng một owner thông báo giữ kết quả đó, và nó chỉ cập nhật khi kết quả đổi |
| Case 5 | Thông điệp mô tả việc điều hướng | Nó sinh ra từ một hiệu ứng điều hướng thật, và nó không mang ngữ nghĩa lỗi trừ khi chính việc điều hướng đã hỏng |
| Case 6 | Kết quả còn quan trọng sau khi khoảnh khắc đó trôi qua | Một owner bền giữ nó sau lần thông báo, nơi người đọc xem lại hoặc hành động tiếp được |

Retired: FEEDBACK-4 đã nghỉ, gộp vào COVERAGE-1, và số này không được dùng lại; địa chỉ đó coi như đã tiêu.

## File này không quyết định

Khi nhiều control cùng tham gia thì ai giữ pending thuộc [Action](action.vi.md), và có những điều
kiện nào thuộc [State](state.vi.md). Người đọc đang được đẩy về phía action nào thuộc
[CTA](cta.vi.md). Receipt phải liệt kê những gì về các đường kết cục này thuộc
[Coverage](coverage.vi.md). Một thông điệp có được gắn về đúng field của nó không, và có được đọc
lên đúng một lần không, thuộc [Accessibility](../proof/accessibility.vi.md) và
[Render truth](../proof/render-truth.vi.md).
