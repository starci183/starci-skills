# Bàn làm việc bộ sưu tập vận hành

## LOADS

Không có.

## Bản ghi

Tài liệu người đọc này công bố đầy đủ quyết định runtime trong `context.md`: dùng `operational-collection-workbench` khi nhân sự liên tục tìm, kiểm tra và thao tác trên các bản ghi tương đồng mà vẫn giữ ngữ cảnh bộ sưu tập. Các tình huống dương là `AR-OCW-01` đến `AR-OCW-05`; các tình huống từ chối là `AR-OCW-90` đến `AR-OCW-92`.

## Sơ đồ vùng

Thứ tự bắt buộc là tiêu đề không gian làm việc, điều khiển tìm kiếm/lọc/sắp xếp khi có, bộ sưu tập hữu hạn cùng phản hồi kết quả và phân trang, vùng chi tiết bản ghi được chọn khi cần, và xác nhận chỉ dành cho hành động có hệ quả. Bộ sưu tập luôn là vùng chính; chi tiết sở hữu dữ kiện và hành động của bản ghi đang chọn.

## Hợp đồng responsive

Màn rộng có thể dùng master-detail phối hợp. Màn trung gian thay pane chi tiết không còn vừa bằng overlay hoặc panel theo bước. Màn hẹp dùng hai bước kết quả và chi tiết, có hành động quay lại giữ nguyên ngữ cảnh. Trang sở hữu cuộn chính; cuộn ngang chỉ thuộc bộ sưu tập khi dữ liệu thiết yếu không thể reflow.

## Nghĩa vụ trạng thái

Các họ trạng thái bộ sưu tập, truy vấn, lựa chọn, chi tiết, hành động, phân trang, focus và responsive phải đầy đủ. Loading, rỗng, lọc-rỗng, lỗi, từ chối quyền, không khả dụng, đang xử lý, thành công và xung đột phải chỉ rõ phạm vi và giữ đường phục hồi. Hành động có hệ quả ngăn cam kết lặp và nêu rõ đối tượng cùng hệ quả trước khi thực thi.

## Ranh giới

Chấp nhận hàng đợi vận hành, moderation, submission, tài khoản, nội dung, audit và backup. Từ chối dashboard tín hiệu hỗn hợp, catalogue dạng card, một tác vụ ngắn, chi tiết tường thuật, lượt đánh giá hữu hạn, điều hướng cây và chỉnh sửa hàng loạt kiểu bảng tính. Thuật ngữ sản phẩm, component, token, class và breakpoint cố định nằm ngoài archetype.

## Bàn giao và đầu ra

Business cung cấp vai trò, loại bản ghi, bộ lọc, chuyển trạng thái và hệ quả. Grammar gán owner ngữ nghĩa; Principles phân giải hình học và mật độ. Trả về các trường chuẩn của shelf cùng bằng chứng `AR-OCW-*` chính xác, không chứa chi tiết triển khai của sản phẩm.
