# @starci/skills — Work 3.0 alpha

Workflow chạy op đã chọn, cây completion `.work` thuộc sản phẩm. Không chain tự động, request/response folder bắt buộc hay tự provisioning.

Đọc [hướng dẫn v3](v3/README.vi.md) và [catalogue op](v3/ops/catalog.json). Tiếng Anh là runtime authority.

Bản checkout này là `3.0.0-alpha.1` cục bộ, chưa publish. Chạy `node bin/starci-skills.mjs work help`, `npm test`; cài thử bằng `init --dir <repo-moi>` và kiểm tra bằng `doctor --dir <repo> --quick`. Không coi package latest trên registry là candidate này. Cần Node 20+, không dependency runtime ngoài.

Installer giữ custom host instructions, chỉ ignore `.work/_local/`, không tạo business hoặc migrate `.worktrees`. Upgrade từ major cũ cần `update --upgrade-major` sau khi đọc hướng dẫn. Giữ local runtime edits trừ khi force rõ ràng; bootstrap xung đột phải xử lý trước khi ghi. `--no-bootstrap` giữ nguyên entry host và không nhận là đã đổi routing.

Profile Lite vẫn cho maintenance nhỏ chưa cần tracking; business được track vào entry v3, không bàn giao session v2.

npm test kiểm tra core/catalogue/CLI/ca phản chứng/installer bằng fixture cục bộ, không thay product UAT. test:legacy giữ suite cũ để điều tra, không phải authority đang chạy. Không publish/deploy/migrate credential hoặc xóa evidence thật trong refactor này.
