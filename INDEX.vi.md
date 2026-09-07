# StarCi Skills 3.0.0-alpha.1

Entry hiện hành: [SKILL.md](SKILL.md). Agent tự chọn op chain theo scope mỗi prompt: tối đa ba lớp tuần tự, mỗi lớp tối đa ba op đồng thời. Cây completion, tài nguyên và evidence thuộc sản phẩm. Không chain vô hạn hoặc request/response ledger bắt buộc.

## Thứ tự đọc

1. Đọc SKILL.md đầy đủ.
2. Đọc [v3/README.md](v3/README.md) và common/document của op trong [catalogue](v3/ops/catalog.json).
3. Resolve đúng business nodes, resources, evidence và source cần cho op.
4. Trước khi sửa package, đọc [UPDATE.md](UPDATE.md).

Runtime mới ở v3/ops, v3/core, v3/schemas, v3/cli; installer ở bin/starci-skills.mjs. Cây .work thuộc sản phẩm, không nằm trong skill.

## Tương thích

operators/, routing.json, workflows/ và script orchestration v2 giữ làm nguồn tham khảo lịch sử, không dùng để chạy 3.0. Dữ liệu .worktrees không bị đổi; migrate cần scope riêng.

npm test kiểm tra v3; test:legacy giữ suite cũ cho điều tra rõ ràng, không tuyên bố installer/entry cũ còn tương thích. Tài liệu website sinh từ v2 không phải hướng dẫn 3.0.

## Phiên bản

3.0.0-alpha.1: op được chọn, cây completion và quyền sở hữu evidence/resource thay chain tự động. Alpha cục bộ, chưa publish hoặc nghiệm thu sản phẩm live.
