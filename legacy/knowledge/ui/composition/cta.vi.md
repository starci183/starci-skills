# Call to action composition

File này trả lời đúng một câu hỏi: trong một vùng quyết định, action nào xứng đáng được nhấn mạnh,
và điểm nhấn đó hứa với người đọc điều gì về hệ quả.

Call to action được chốt từ hệ quả, không bao giờ từ mong muốn có một control to hơn hay sáng hơn.
Variant, ngữ nghĩa, các trạng thái bị chặn và thứ tự của một nhóm action đều được quyết trước khi
dựng vùng, bởi mỗi thứ trong số đó là một lời hứa mà trang sau khi render phải giữ.

## CTA-1 — Điểm nhấn đi theo hệ quả

Chi phối control nào mang treatment mạnh nhất.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Một vùng quyết định có đúng một bước kế tiếp rõ ràng | Đúng một `Button variant="primary"` nằm trong decision owner đó, mang `onPress`, hoặc mang `href` khi bước kế tiếp là một điểm đến |
| Case 2 | Các action khác trong cùng vùng là lựa chọn thay thế thật sự | Mỗi cái mang một variant công khai yếu hơn trong `secondary`, `tertiary`, `outline` hoặc `ghost`, nói đúng hệ quả thật của nó |
| Case 3 | Direction muốn control to hơn hoặc chói hơn mà hệ quả không đổi | Variant không đổi, và không công thức button cục bộ nào đứng cạnh control đó |
| Case 4 | Action nằm trong toolbar dày, trong card, hay ở tầm quyết định của cả trang | `size` được gắn qua prop công khai theo đúng bối cảnh tương tác đó, và không button vendor nào bị sơn lại để đạt được nó |

Không phải rule này: đếm xem cả trang tiêu bao nhiêu điểm nhấn chủ đạo thuộc ACCENT-1.

## CTA-2 — Điểm đến hay câu lệnh

Chi phối việc người đọc thật ra đang thao tác với thứ native nào.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Kích hoạt sẽ đưa người đọc tới một địa chỉ thật | `TextAction` hoặc `Button` mang `href`, và hình dạng nút chỉ đổi phần sơn |
| Case 2 | Kích hoạt sẽ thay đổi state của ứng dụng | `Button`, hoặc `TextAction` khi câu lệnh cần đọc như chữ, mang một handler thật |
| Case 3 | Action mang một glyph chỉ hướng | Glyph nằm trong `startContent` hoặc `endContent`, và nhãn chữ nhìn thấy được vẫn ở lại |
| Case 4 | Direction muốn một mũi tên không kèm chữ làm bước tiếp | Quyết định chủ đạo giữ nhãn chữ nhìn thấy được, và mọi glyph trên nó chỉ là phần bổ trợ |

Không phải rule này: một lần kích hoạt được phép sinh ra bao nhiêu hiệu ứng thuộc ACTION-1.

## CTA-3 — Không dùng được, đang chạy và chưa giải quyết là ba điều kiện

Chi phối việc control đang thật sự nằm ở dạng chặn nào trong ba dạng.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Việc không thể bắt đầu, vì thiếu quyền hoặc thiếu tiền đề | `isDisabled` được gắn trên control đó, và không carrier pending nào được gắn |
| Case 2 | Chính control này đã nhận việc và việc chưa xong | `isPending` được gắn trên đúng control đó, nhãn nhìn thấy được và khung ngoài không đổi, và kích hoạt lần hai bị từ chối |
| Case 3 | Nội dung ban đầu chưa giải quyết và chưa ai bấm gì | `isSkeleton` được gắn trên owner, và không carrier pending nào xuất hiện ở đâu cho nội dung đó |
| Case 4 | Có một request khác đang chạy ở chỗ khác trên trang | Các control ngang hàng giữ carrier của riêng chúng, và không pending nào chạm tới một control chưa khởi động gì |

Không phải rule này: khi nhiều control cùng tham gia thì ai giữ pending thuộc ACTION-2.

## CTA-4 — Hệ quả huỷ hoại cần authority riêng

Chi phối action cuối cùng mà không thể hoàn tác.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Một action xoá, thu hồi hoặc vứt bỏ vĩnh viễn thứ có giá trị | Receipt mang copy nêu rõ tính huỷ hoại, một bước xác nhận tương xứng với hệ quả, và một treatment action danger có kiểu |
| Case 2 | `ButtonVariant` công khai chưa có giá trị danger | Một gap `GRAMMAR_REQUIRED` ghi nhận điều đó, và CTA không được đưa lên variant primary để thay thế |
| Case 3 | Direction bị cám dỗ import variant danger của vendor, hoặc thêm màu đỏ cục bộ | Không variant danger của vendor và không màu đỏ cục bộ nào đứng cạnh control đó |
| Case 4 | Action là một thao tác huỷ có thể hoàn tác hoặc một kết cục tiêu cực thường | Nó không mang treatment huỷ hoại và không mang bước xác nhận sinh ra từ tính huỷ hoại |

## CTA-5 — Thứ tự nhóm qua các bề rộng

Chi phối trình tự của hai action trở lên cùng tạo nên một quyết định.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Một quyết định có action chủ đạo, một lựa chọn thay thế và một lối ra | Thứ tự DOM chạy từ quyết định chủ đạo, tới lựa chọn thay thế, rồi tới lối ra hoặc lối phục hồi, tuỳ sản phẩm yêu cầu |
| Case 2 | Nhóm wrap hoặc xếp chồng ở bề rộng hẹp hơn | Thứ tự đọc và thứ tự focus tuần tự trùng khít nhau ở mọi bề rộng, và không CSS `order` nào đảo nhóm |
| Case 3 | Một nhãn đã dịch dài hơn hẳn bản gốc | Receipt gọi tên nhãn dài nhất mà nhóm phải chứa, và ở độ dài đó nhóm wrap hoặc xếp chồng chứ không chồng lấn |
| Case 4 | Hai action nằm ở hai vùng khác nhau | Chúng thuộc hai decision owner riêng trong receipt, và không cái nào so cấp với cái kia |

## File này không quyết định

Vùng nào chứa quyết định thuộc [Layout](layout.vi.md), và anchor nào gọi tên vùng thuộc
[Hierarchy](hierarchy.vi.md). Một lần kích hoạt được sinh bao nhiêu hiệu ứng và ai giữ pending thuộc
[Action](action.vi.md). Treatment chủ đạo khan hiếm tới đâu trên cả trang thuộc
[Accent](accent.vi.md), và sau khi action xong thì nói gì thuộc [Feedback](feedback.vi.md). Receipt
phải liệt kê những gì về các action này thuộc [Coverage](coverage.vi.md). Control sau khi render có
chạm tới được, có tên và có focus nhìn thấy được không thuộc
[Accessibility](../proof/accessibility.vi.md) và [Focus](../proof/focus.vi.md).
