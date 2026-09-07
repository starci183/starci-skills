# Bảo trì StarCi Work 3.0

Đọc entry, contract/source cần sửa và consumer trước khi thay đổi. Scope major refactor do người dùng yêu cầu; không mở session/chain request-response v2 để bảo trì v3.

Core schema định nghĩa dữ liệu; core tính validation/digest/rollup. Common policy giữ quy tắc chung; từng op giữ đầu vào, nơi ghi và chứng cứ theo nghiệp vụ. Entry chỉ dẫn tới nguồn thẩm quyền đó.

Đổi contract cùng consumer, giữ ID ổn định, version hóa ý nghĩa không tương thích. Tiếng Anh là authority, tiếng Việt là mirror. Không đưa danh tính sản phẩm, machine path hoặc credential vào luật dùng chung.

Kiểm tra source thật trước khi sửa; tách quan sát, yêu cầu và suy luận. Ví dụ synthetic phải ghi rõ. Có test từ chối evidence thiếu/đổi, stale input, path escape, scope mơ hồ, coverage thiếu. Hash không chứng minh một nhận xét là trung thực.

Chạy test v3 liên quan và npm test trước giao. Sửa installer/payload thì kiểm tra cài sang thư mục mới và CLI. Commit đúng piece, giữ thay đổi người dùng; ghi rõ check fail/chưa chạy. File generated phải sửa producer rồi regenerate. Suite/tài liệu v2 được giữ cho điều tra lịch sử, không thay acceptance v3.

Đổi version không phải publish. Không suy ra quyền push/npm publish/deploy/account/migrate .worktrees từ yêu cầu sửa package. Upgrade major phải opt-in, không đổi dữ liệu sản phẩm. Giữ custom bootstrap; xung đột protocol thì dừng trước ghi payload. Audit nguồn Git/evidence/secret trước migration riêng.
