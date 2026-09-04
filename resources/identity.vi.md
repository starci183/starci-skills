# Thao tác danh tính

[identity.json](identity.json) sở hữu chính sách bind provider/custody và truyền dữ liệu.
Khi provisioning, `scripts/identity-custody.mjs` đối chiếu entry đã chọn với container đang chạy, cổng công bố và
tham chiếu credential được mount trước khi resolve giá trị. File trùng tên ở repository khác
không phải nguồn credential thay thế.

Xoay credential quản trị theo [contract identity của platform](../operators/platform-operate/operator.md#requirements), gồm binding môi trường bootstrap đã thu khi provider không mount file credential.

Thao tác chạy trong helper cố định, thu pipe của tiến trình con. Byte giải mã đi thẳng vào request
của provider hoặc sản phẩm đã định. Helper chỉ báo bước, trạng thái, danh tính tài khoản và tham
chiếu bằng chứng; body provider thô và exception tiến trình không đi vào transcript. Từ chối
redirect và đặt timeout từng request. Không thay lệnh dùng credential bằng đọc file chung, dump
môi trường hay echo chẩn đoán.

Provisioning theo contract đăng ký được sản phẩm hỗ trợ để cả identity provider lẫn tài khoản
sản phẩm tồn tại. Ghi kết quả mutation chưa rõ là chưa rõ và đối chiếu tài khoản riêng trước khi
thử lại. Lookup tài khoản thành công chưa phải bằng chứng đăng nhập: kiểm đăng nhập sản phẩm rồi
phiên trình duyệt cho flow. API không sẵn sàng là finding runtime cần sửa qua ladder đã khai,
không phải lý do thử credential lại.

Sources: [Bằng chứng sửa owner](../tests/evidence/20260904-owner-repair.md).
