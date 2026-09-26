# StarCi Status UI

Dashboard cục bộ, chỉ đọc, dành cho thầy. Giao diện tiếng Việt, nền đen, dùng Vite/React và các thành phần shadcn/ui.

## Chạy

Windows: chạy `start.cmd`. Hoặc trong thư mục này:

```powershell
npm install
npm run dev
```

Mở [http://127.0.0.1:4545](http://127.0.0.1:4545). Cần Node.js 22.13+.

Bản chạy tại `https://harness.starci.org` dùng Cloudflare Tunnel riêng. Xem [DEPLOYMENT.md](DEPLOYMENT.md) để build, chạy và kiểm tra. Bản production bắt buộc tài khoản owner; mật khẩu chỉ được tạo một lần bằng `node init-auth.mjs` và không lưu trong Git.

## Có gì trên màn hình

- **Tổng quan:** số workflow, tín hiệu kernel, worker, việc chờ thầy, OWED và verdict gần đây.
- **Dự án:** tổng theo Nivo, StarCi Next, Mia Mia; vào từng dự án để xem workflow và điểm nghẽn.
- **Workflow:** mục tiêu, tiến độ từng chặng, frontier, việc đang chạy/chờ, incident, peer-wait và verdict gần nhất.
- **Agents:** Qwen, Devin, Claude, Codex; Kernel điều phối tách khỏi op worker. Mỗi op có câu hành động tiếng Việt, mã op, lần chạy, chặng và mô tả nhiệm vụ gốc từ ledger. Nút **Nhật ký** mở mốc hoạt động trực quan và tab terminal nguyên văn của đúng agent, tự cập nhật mỗi 5 giây. Nút **Diff & ảnh** đọc Git diff của tệp code và ảnh trong các đường dẫn được giao cho op, tự cập nhật mỗi 15 giây. CPU/RAM là số tổng hợp theo loại tiến trình. Logo xuất hiện cả trong bảng workflow và chi tiết workflow.
- **Kết quả kiểm tra:** lịch sử `pass`, `fail`, `blocked` theo từng lần chạy op, có số check đạt/trượt.
- **Cần thầy làm:** tách câu hỏi duyệt và yêu cầu credential; chỉ hiện link mẫu khi runtime báo còn sống.
- **Giám sát:** OWED, inbox, land queue, lần push và pool nền.

API ở `127.0.0.1:4546` có `GET /api/snapshot`, `GET /api/agents` và `GET /api/agents/:terminal/log` cho terminal thuộc danh sách đang theo dõi. Snapshot ledger làm mới tối đa mỗi 30 giây; agent làm mới mỗi 10 giây. Log là tối đa 80 dòng của màn hình terminal hiện tại qua lệnh đọc `orca terminal read --screen`; không phải lịch sử đầy đủ. `config.yaml` hiện đặt `language: vi`, nên dashboard diễn giải các mốc hoạt động và nhiệm vụ bằng tiếng Việt. Lệnh và đầu ra công cụ trong tab **Terminal gốc** được giữ nguyên ngôn ngữ để đối chiếu; cấu hình ngôn ngữ không tự dịch nội dung do CLI hoặc công cụ khác phát ra. API dùng các lệnh đọc của runtime (`progress-report --json`, `status --json`, `owed --json`, `inbox --peek --json`), `orca terminal list --json` và mở ledger SQLite với `readOnly: true` để cộng verdict từ sự kiện `op-settled` và ghép agent với terminal. Trên Windows, `process-sample.ps1` đọc danh sách tiến trình và bộ đếm CPU/bộ nhớ; chỉ trả số tổng hợp. Không có đường ghi hoặc nút điều khiển workflow.

`GET /api/agents/:job/changes` trả diff Git chưa stage, đã stage, tệp code mới, tối đa 3 commit gần nhất từ khi op bắt đầu và danh sách ảnh từ các `owned_paths` của op đang chạy. `GET /api/agents/:job/images/:id` chỉ phục vụ ảnh trong phạm vi đó. Diff và ảnh có thể là thay đổi chung của checkout nếu nhiều agent dùng cùng một repo; đây là quan sát theo phạm vi op, không phải bằng chứng chắc chắn agent nào đã viết từng dòng. “Đang cook” là tín hiệu terminal có output gần đây và đang hiện trạng thái xử lý; “Mở · chưa có tín hiệu” không kết luận agent đã dừng hay đang chờ chủ máy.

CPU là phần trăm năng lực CPU toàn máy, RAM là tổng private bytes của các tiến trình cùng loại (kể cả phiên ngoài StarCi). Orca không trả PID của terminal nên các số này **không phải** CPU/RAM riêng từng agent. Vòng quay chỉ xuất hiện khi terminal Orca có tín hiệu hoạt động gần đây. Tên model trên thẻ lấy từ runtime ledger; terminal không gắn workflow sẽ hiện model chưa xác minh. Trên hệ điều hành ngoài Windows, phần CPU/RAM sẽ hiện dấu `—`.

Logo lưu cục bộ trong `public/logos/`, lấy từ favicon của [Qwen Code](https://qwenlm.github.io/qwen-code-docs/), [Devin](https://devin.ai/), [Claude](https://claude.com/) và [Codex](https://developers.openai.com/codex/). Vòng sáng quay quanh logo, không biến dạng logo; thiết bị yêu cầu giảm chuyển động sẽ không chạy animation.

Số lần `pass/fail/blocked` là lịch sử của op trong các workflow đang chạy, không phải số workflow đã hoàn thành. Nhãn kernel “có tín hiệu” dựa trên signal còn hiệu lực và trạng thái `api status`, không thay thế kiểm tra terminal trực tiếp; `signals.at` không được coi là heartbeat. Các chuỗi hiển thị được rút gọn và lọc mẫu credential thông dụng trước khi gửi tới trình duyệt.
