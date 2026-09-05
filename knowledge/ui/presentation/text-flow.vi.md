# Text flow presentation

File này trả lời đúng một câu hỏi: chữ hành xử ra sao bên trong một vùng đã chốt kích thước.

Composition đã chọn cây DOM, [Font](font.md) đã đặt hạng, và [Measure](measure.md) đã đặt chỗ. Text
flow giải quyết canh lề, xuống dòng, và chuyện gì xảy ra khi chữ không vừa.

Giá trị mặc định mới là đáp án đúng, thường xuyên hơn bất kỳ rule nào ở đây. Chữ bắt đầu từ mép đọc
và xuống dòng tự nhiên thì không cần class nào cả.

## Danh mục

| Rule | Quyết định | Mặc định |
| --- | --- | --- |
| FLOW-1 | Canh lề theo trục inline | Đầu dòng |
| FLOW-2 | Một dòng có được phép ngắt không | Có xuống dòng |
| FLOW-3 | Ngắt bên trong một chuỗi liền không khoảng trắng | Cho phép khi tràn |
| FLOW-4 | Cắt cụt một dòng | Tắt |
| FLOW-5 | Chặn số dòng | Tắt |

Cắt cụt là gỡ bỏ thông tin. FLOW-4 và FLOW-5 chỉ hợp lệ khi toàn văn còn đọc được ở chỗ khác, và
không bao giờ dùng cho một giá trị mà người đọc phải hành động theo.

## Owner

| Owner | Nghĩa | Ứng dụng viết |
| --- | --- | --- |
| `App` | Vùng chữ thuộc về ứng dụng | Viết class |
| Tên component | Common đã xử lý hành vi này | Không viết gì, chỉ ghép component |
| `—` | Common chưa có đường dùng công khai | Viết class, ghi nhận là workaround |

Mọi vùng có xuống dòng đều cần thêm `min-w-0` từ [Measure](measure.md). Thiếu nó thì cắt cụt và chặn
dòng hỏng trong im lặng, vì vùng không bao giờ hẹp hơn từ dài nhất của nó.

## Text flow mà Common đã sở hữu

Sinh từ claim của `@grammar/core` bằng `scripts/generate-presentation-owned.mjs`; muốn đổi thì sửa component, đừng sửa bảng này.

| Component | Phần tử hoặc điều kiện | Rule |
| --- | --- | --- |
| `MediaFrame` | caption, caption!=undefined | FLOW-3 |
| `PressableField` | placeholder | FLOW-4 |
| `SectionHeader` | title | FLOW-3 |
| `Sidebar` | item label, not collapsed | FLOW-4 |
| `Subnav` | title | FLOW-4 |
| `Tabs` | hero tabs list container wrapper | FLOW-2 |
| `Tooltip` | content | FLOW-2 |

## FLOW-1 — Canh lề

Chữ bắt đầu từ mép đọc, trừ khi bản thân nội dung là một con số đang được đem so sánh.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Mọi văn xuôi, nhãn, tiêu đề hay lời giải thích | `App` | Không viết class. Canh đầu dòng là mặc định |
| Case 2 | Một cột số mà các giá trị được so sánh dọc theo cột | `App` | `text-end` trên ô, áp cho cả cột |
| Case 3 | Một dòng ngắn duy nhất canh giữa trong một vùng cố ý đối xứng | `App` | `text-center` chỉ trên vùng do app sở hữu |

Không phải rule này: canh giữa cả đoạn văn. Khối canh giữa có mép đầu răng cưa, và mỗi dòng bắt người
đọc phải đi tìm chỗ bắt đầu. Không bao giờ dùng canh đều hai bên, vì ở những khổ mà hệ này hỗ trợ nó
mở ra các dòng sông khoảng trắng lệch nhau.

## FLOW-2 — Xuống dòng

Một dòng mặc định là có xuống dòng. Chặn nó lại là một lời hứa rằng nội dung ngắn.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Mọi nội dung mà độ dài không cố định | `App` | Không viết class. Xuống dòng là mặc định |
| Case 2 | Nhãn control, badge hay tab không được ngắt giữa cụm từ | Chính component đó | Ghép nó, Common đã giữ trên một dòng |
| Case 3 | Code phải giữ đúng các dấu xuống dòng của chính nó | `FencedCodeBlock` | Ghép khối, nó cuộn thay vì xuống dòng |

Không phải rule này: `whitespace-nowrap` trên chữ đã dịch hoặc chữ do người dùng nhập. Một cụm vừa
khít ở ngôn ngữ này sẽ tràn ở ngôn ngữ khác, và cái tràn đó chỉ lộ ra sau khi phát hành.

## FLOW-3 — Ngắt bên trong một từ

Một chuỗi liền không khoảng trắng, dài hơn vùng chứa, thì ngắt ra chứ không thoát ra ngoài.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Nội dung có thể chứa URL, token, mã định danh hay chuỗi dán vào | `App` | `break-words` trên vùng do app sở hữu |
| Case 2 | Tiêu đề section, chú thích ảnh và văn xuôi article | Chính component đó | Ghép nó, Common đã ngắt sẵn |

Đây là rule chặn thanh cuộn ngang ở cấp trang. Chỉ một địa chỉ email trong một cột hẹp là nong rộng
mọi phần tử tổ tiên nếu thiếu nó.

Không phải rule này: ngắt các nhãn ngắn, vì như vậy đẻ ra một ký tự lạc lõng ở dòng thứ hai.

## FLOW-4 — Cắt cụt một dòng

Một dòng bị cắt kèm dấu ba chấm vì vùng của nó có chiều rộng cố định và giá trị đầy đủ có ở chỗ khác.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Tiêu đề trong một dải rộng cố định, toàn văn nằm ở trang đích | `Subnav` | Ghép nó, Common đã cắt cụt sẵn |
| Case 2 | Nhãn một hàng do app sở hữu, giá trị đầy đủ mở ra được bằng cách mở hàng đó | `App` | `truncate` cùng `min-w-0` trên chính phần tử đó |

Chữ nhìn thấy vẫn phải giữ nguyên accessible name đầy đủ. Một nhãn cắt cụt mà cắt luôn accessible
name là xóa hẳn giá trị đó khỏi đầu ra cho trình đọc màn hình.

Không phải rule này: giá tiền, trạng thái, lỗi, hạn chót, hay bất kỳ giá trị nào người đọc phải hành
động theo. Cho vùng đó thêm chỗ thay vì cắt.

## FLOW-5 — Chặn số dòng

Một khối bị cắt sau một số dòng cố định, và người đọc mở ra xem toàn văn được.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Mô tả của card trong một lưới mà các card phải bằng chiều cao | `—` | `line-clamp-2` kèm một cách để mở phần còn lại |
| Case 2 | Một đoạn xem trước mà toàn văn chính là đích đến của hàng đó | `—` | Cũng vậy, chính hàng đó là cách mở |

Chặn dòng mà không có đường đọc tiếp là xóa nội dung. Cái đường mở đó là một phần của rule, không
phải thứ thêm vào sau. Common chưa có prop chặn dòng nào, nên cả hai case đều là workaround có ghi
nhận.

Không phải rule này: chặn dòng để giấu một lỗi layout. Nếu hai card lệch chiều cao vì nội dung khác
nhau, thì đó là nội dung, không phải lỗi.

## File này không quyết định

Cỡ chữ và độ đậm thuộc về [Font](font.md). Màu chữ thuộc về [Tone](tone.md). Vùng được bao nhiêu chỗ
thuộc về [Measure](measure.md). Ranh giới nào cuộn thuộc về [Overflow](overflow.md).
