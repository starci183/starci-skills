# Hierarchy composition

File này trả lời đúng một câu hỏi: một mảng ý nghĩa business thì nhận cấp độ thông tin nào, và nó
đứng ở đâu so với mọi thứ còn lại trong vùng của nó.

Cấp độ được quyết từ công việc mà nội dung đang làm, không bao giờ từ mong muốn cho nó trông nổi bật
hơn. Cấp độ do một semantic owner công khai mang, nhờ vậy dàn bài mà trình đọc màn hình đi qua và
dàn bài mà mắt người đọc thấy vẫn là cùng một dàn bài.

## HIERARCHY-1 — Cấp độ đến từ công việc, không đến từ vẻ ngoài

Chi phối việc semantic owner nào mang một mảng nội dung.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Nội dung đặt tên cho một trang hoặc một section | `Heading` mang nó, ở đúng level mà dàn bài yêu cầu |
| Case 2 | Nội dung giải thích, hoặc nêu một sự kiện trung tính | `Text` ở vai trò mặc định mang nó, không gắn kèm state owner nào |
| Case 3 | Nội dung báo một kết cục ngắn gọn có authority chống lưng | `Badge`, hoặc một state owner công khai khác cho kết cục đó, mang nó |
| Case 4 | Nội dung báo một mức hoàn thành đã được kiểm chứng | `Progress` mang nó, với label và value cùng mô tả một phép đo đã kiểm chứng |
| Case 5 | Có thứ trông quan trọng nhưng không khớp vai trò công khai nào | Receipt gọi tên công việc của nó trước khi gắn owner, và không utility type cục bộ nào đứng thay cho một cấp độ |

Không phải rule này: cấp độ đó nhận bao nhiêu điểm nhấn thuộc ACCENT-1.

## HIERARCHY-2 — Mỗi vùng một anchor mạnh nhất

Chi phối số thứ được phép đặt tên cho cùng một vùng.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Một vùng có tên gọi cộng với phần bổ trợ, dữ kiện, trạng thái hoặc action | Đúng một anchor ngữ nghĩa mạnh nhất gọi tên công việc của vùng, qua `SectionHeader`, `Heading` hoặc một surface có nhãn |
| Case 2 | Hai ứng viên cùng trông như tên của vùng | Hoặc receipt liệt kê hai vùng ngang hàng, mỗi vùng một anchor, hoặc một ứng viên mang cấp độ yếu hơn |
| Case 3 | Một trạng thái muốn to tiếng hơn thứ mà nó mô tả | Trạng thái xếp dưới cái tên mà nó bổ nghĩa |
| Case 4 | Các vùng ngang hàng độc lập nằm cạnh nhau | Anchor của mỗi vùng được chốt trong chính vùng đó; không anchor nào so cấp với anchor của vùng khác |

Không phải rule này: vùng nào đứng trước trên trang thuộc LAYOUT-1.

## HIERARCHY-3 — Thứ tự đọc bằng đúng thứ tự phụ thuộc của nhiệm vụ

Chi phối trình tự mà ý nghĩa được trao cho người đọc.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Người đọc cần bối cảnh trước khi ra lựa chọn | Thứ tự DOM chạy tiền đề, quyết định, hệ quả, rồi phần bổ trợ |
| Case 2 | Ở một bề rộng nào đó bố cục sẽ đọc mượt hơn nếu đảo các mảnh | Composition khác đi ở bề rộng đó còn thứ tự ý nghĩa thì không; không CSS `order` nào đảo ngược ý nghĩa |
| Case 3 | Có phần trợ giúp giải thích một field hoặc một nhiệm vụ | Nó đứng sau thứ mà nó giải thích, trong thứ tự DOM và trong accessibility tree |
| Case 4 | Một kết quả do một action trên cùng surface sinh ra | Action đứng trước kết quả mà nó sinh ra, ở mọi bề rộng |

Không phải rule này: chuyện focus tuần tự có thật sự đi theo thứ tự này sau khi render thuộc FOCUS-2.

## HIERARCHY-4 — Dữ kiện, phép đo và kết cục là ba cấp độ khác nhau

Chi phối ranh giới giữa cái chỉ đơn thuần là đúng, cái đã được đo, và cái đã được kết luận.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Nội dung là một dữ kiện trung tính, không kèm tuyên bố nào | `Text` mang nó, không kèm trạng thái và không kèm treatment thành công |
| Case 2 | Nội dung là một phép đo từ 0 đến 100 có authority chống lưng | `Progress` mang nó, và label cùng value mô tả đúng một phép đo đã kiểm chứng |
| Case 3 | Phép đo chưa giải quyết xong | `Progress isSkeleton` mang nó, và không giá trị không nào được render thay chỗ |
| Case 4 | Nội dung là một kết cục mà người đọc có thể hành động theo | Một từ nêu kết cục rõ ràng cùng state owner của nó mang việc đó; không màu nào tự mình nêu kết cục |
| Case 5 | Direction bị cám dỗ để một cấp độ ngụ ý một cấp độ khác | Không thanh đầy nào đứng cho một mức hoàn thành, và không dữ kiện bình thường nào nhận treatment cảnh báo |

## HIERARCHY-5 — Cấp độ sống sót qua reflow, qua lúc tải và qua khi mất màu

Chi phối những điều kiện mà phân cấp đã chọn vẫn phải đứng vững.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Vùng xếp chồng lại ở bề rộng hẹp | Thứ tự heading và số anchor mạnh nhất trùng khít nhánh rộng; chỉ vị trí là khác |
| Case 2 | Nội dung còn đang tải | Skeleton mang đúng vai trò đã chọn của nội dung thật, nên không cấp độ nào nhảy khi nội dung thật về |
| Case 3 | Nội dung tuỳ chọn vắng mặt ở một số trạng thái | Mọi cấp độ có mặt ở một trạng thái đều có carrier sống sót qua các trạng thái mà nội dung tuỳ chọn vắng mặt |
| Case 4 | Màu bị bỏ đi, hoặc người xem đang ở chế độ forced colors | Mọi khác biệt cấp độ vẫn phân giải về một dấu hiệu ngữ nghĩa hoặc cấu trúc |

Không phải rule này: việc chụp lại các bản render đã zoom, forced colors và đã bỏ màu là công việc
của operator audit.

## File này không quyết định

Trang có những vùng nào và ai sở hữu track thuộc [Layout](layout.vi.md). Cấp độ hành xử ra sao khi
không gian đổi thuộc [Responsive](responsive.vi.md). Action nào là chủ đạo thuộc [CTA](cta.vi.md),
và phần nhấn mạnh khan hiếm tiêu ở đâu thuộc [Accent](accent.vi.md). Cây accessibility chứng minh
dàn bài này nằm ở [Accessibility](../proof/accessibility.vi.md), còn sự khớp nhau giữa cấp độ và sự
thật sản phẩm nằm ở [Render truth](../proof/render-truth.vi.md).
