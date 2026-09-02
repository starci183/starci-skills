# Feedback composition

File này trả lời đúng một câu hỏi: khi có thứ gì đó hỏng, thành công, hoặc cần sửa, ai là người
thông báo, và owner đó nhỏ tới đâu.

Feedback được chốt ở chỗ nhỏ nhất mà thật sự sửa hoặc phục hồi được. Một lỗi báo ở nơi xa hơn chỗ có
thể sửa nó sẽ bắt người đọc đi tìm nguyên nhân, còn một lối phục hồi ở tầm cả trang cho một panel
hỏng sẽ ném đi cả phần công việc chưa từng hỏng.

## FEEDBACK-1 — Sửa ở owner gần nhất

Chi phối chỗ ở của một lỗi validation.

| Case | Dùng khi | Chốt |
| --- | --- | --- |
| Case 1 | Một field đang có lỗi validation mà người đọc sửa được ngay tại field đó | `Input.errorMessage` mang cả lỗi lẫn cách sửa, với `isError` đặt từ đúng dữ kiện không hợp lệ đó |
| Case 2 | Field có phần hướng dẫn thường trực, đúng dù nó có lỗi hay không | `hint`, vốn không phải lỗi và không xuất hiện rồi biến mất theo validation |
| Case 3 | Cùng lỗi đó còn được tóm tắt lại ở phía trên form | Không làm. Một chỗ sửa do field sở hữu tránh được hai owner cho một dữ kiện |
| Case 4 | Thông điệp là điều hướng hoặc trạng thái chung chứ không phải một giá trị bị từ chối | Render nó thành status ở chỗ khác. Không dán nhãn nó là validation |
| Case 5 | Giá trị thay đổi, hoặc validation chạy lại | Lỗi được cập nhật hoặc gỡ đi theo, và phần người đọc đã nhập vẫn được giữ |

## FEEDBACK-2 — Phục hồi ở owner hành động nhỏ nhất

Chi phối chỗ ở của một nút thử lại.

| Case | Dùng khi | Chốt |
| --- | --- | --- |
| Case 1 | Một vùng rỗng hoặc vùng lỗi có một bước kế tiếp thật | `EmptyNotice` gọi tên đúng vùng bị ảnh hưởng, với `actionLabel` và `onAction` cho bước đó và một `description` tuỳ chọn |
| Case 2 | Action phục hồi đã nhận việc | `isActionPending` trong lúc nó chạy, và chỉ cho action đó |
| Case 3 | Nối một nút tải lại cả trang thì dễ hơn | Với một panel hỏng thì đó không phải câu trả lời. Phục hồi được giới hạn đúng vào thao tác đã hỏng |
| Case 4 | Lặp lại thao tác là không an toàn, như với một giao dịch mua | Cấp một lối phục hồi an toàn có authority chống lưng, thay cho một nút thử lại chung chung |
| Case 5 | Người đọc còn công việc chưa lưu ở chỗ khác trên trang | Nó sống sót qua lần phục hồi. Chỉ vùng đã hỏng bị thay |

## FEEDBACK-3 — Phải biết việc đã kết thúc rồi mới được nói

Chi phối thời điểm được phép nêu một kết quả.

| Case | Dùng khi | Chốt |
| --- | --- | --- |
| Case 1 | Một câu lệnh đang chờ kết quả | Pending chỉ được gỡ từ một kết thúc thật, và copy kết quả khớp với kết cục thật sự đã về |
| Case 2 | Một kết quả không khẩn cần được đọc lên | `Text live="polite"` trên owner nhỏ nhất của status đó |
| Case 3 | Thông điệp thật sự khẩn và việc cắt ngang là chính đáng | `live="assertive"`, dành riêng cho đúng trường hợp đó |
| Case 4 | Cùng một kết quả sẽ xuất hiện ở hai chỗ | Không làm. Một owner thông báo duy nhất, chỉ cập nhật khi kết quả đổi |
| Case 5 | Thông điệp mô tả việc điều hướng | Nó được render từ một hiệu ứng điều hướng thật, và một status điều hướng mặc định không phải là lỗi |
| Case 6 | Kết quả còn quan trọng sau khi khoảnh khắc đó trôi qua | Nó ở lại một nơi bền, chỗ người đọc xem lại hoặc hành động tiếp được |

## FEEDBACK-4 — Những đường đi mà direction cam kết

Chi phối những kết cục mà phần audit sẽ được yêu cầu chạy.

| Case | Dùng khi | Chốt |
| --- | --- | --- |
| Case 1 | Một luồng có thể hỏng, được sửa, thử lại hoặc bị huỷ | Gọi tên mọi đường hỏng, sửa, thử lại, thành công, lỗi và huỷ mà chạm tới được |
| Case 2 | Việc phục hồi thay thế một phần của surface | Phần nhập được giữ lại và thao tác thật sự được phục hồi đều nằm trong phạm vi, không chỉ thông điệp nhìn thấy |
| Case 3 | Có đường nào để lại việc đang chạy | Không đường nào kết thúc bằng một pending không bao giờ xong |
| Case 4 | Một family hoặc ứng dụng thêm delta | Tách riêng từng tầng, để một thông báo bị lặp quy được về đúng tầng |

Không phải rule này: việc đếm thông báo và truy vết kết quả request là công việc của operator audit.

## File này không quyết định

Khi nhiều control cùng tham gia thì ai giữ pending thuộc [Action](action.vi.md), và có những điều
kiện nào thuộc [State](state.vi.md). Người đọc đang được đẩy về phía action nào thuộc
[CTA](cta.vi.md). Một thông điệp có được gắn về đúng field của nó không, và có được đọc lên đúng một
lần không, thuộc [Accessibility](../proof/accessibility.vi.md) và
[Render truth](../proof/render-truth.vi.md).
