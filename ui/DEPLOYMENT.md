# Triển khai harness.starci.org

## Ranh giới

- Mã giao diện/API được commit trực tiếp trong repo nguồn `.claude` (`starci183/starci-skills`), tại `<Source>/.claude/ui`. Ứng dụng cần runtime `<Source>/.claude` trên cùng máy để đọc các module và CLI hiện có; không thể triển khai độc lập lên Cloudflare Pages.
- `npm run build` tạo UI tĩnh; `npm run serve` phục vụ UI và các endpoint chỉ đọc trên `127.0.0.1:4547`. Các ledger SQLite vẫn nằm trong repo dự án và được mở `readOnly: true`.
- Tunnel riêng `starci-harness` (`3c3469d5-8493-4af0-b13f-68f0ae5b9a8c`) kết nối `harness.starci.org` tới loopback. Credential tunnel và `harness.yml` nằm ngoài Git tại `%USERPROFILE%/.cloudflared/`.
- Origin phục vụ công khai, không yêu cầu mật khẩu. Dashboard, nhật ký terminal đã rút gọn, code diff và ảnh trong phạm vi op có thể xem qua Internet. Nếu máy, phiên đăng nhập hoặc tunnel dừng thì trang ngoài Internet tạm không sẵn sàng; DNS vẫn tồn tại.
- Trước khi chuyển route, `harness.starci.org` là CNAME tới `starci183.github.io` và phục vụ trang “StarCi Skills”. Để rollback, khôi phục CNAME này rồi ngừng hai tác vụ StarCi Harness.

## Khởi tạo trên máy chủ

```powershell
cd <Source>/.claude/ui
npm ci
npm run build
npm run serve
```

Tunnel chạy với `run-cloudflared.ps1`. Trước khi dùng, tạo named tunnel và DNS route bằng Cloudflare CLI, đặt `harness.yml` trỏ tới `http://127.0.0.1:4547`, và kiểm tra `cloudflared tunnel --config <file> ingress validate`. Trên máy hiện tại, Windows Task Scheduler chạy ứng dụng và tunnel khi chủ máy đăng nhập, tự khởi động lại khi tiến trình lỗi.

## Xác minh

1. Không có Authorization: `/` trả HTML, `/api/agents` trả danh sách agent, `/api/snapshot` trả dữ liệu dự án.
2. `/api/agents/:job/changes` trả các patch và ảnh trong phạm vi op đang chạy; trang `/#/changes` hiện code diff trực tiếp.
3. Tunnel có các edge connection đã đăng ký; DNS `harness.starci.org` trỏ tới tunnel ID.
4. Qua HTTPS: khách chưa đăng nhập xem được dashboard và API không bị cache.
5. Khởi động lại hai tác vụ để kiểm tra phục hồi. Không dùng HTTP Basic qua HTTP công khai; Cloudflare phục vụ hostname bằng HTTPS.

## Tài liệu nhà cung cấp đã đọc

Đọc ngày 2026-09-26: [Cloudflare local tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/create-local-tunnel/) mô tả ingress, DNS route và lệnh run; [DNS records for Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/dns/) xác nhận CNAME và tunnel hoạt động là hai phần độc lập; [Windows service guidance](https://developers.cloudflare.com/tunnel/features/locally-managed-tunnels/as-a-service/windows/) nêu lifecycle chạy lâu dài. Không có callback hay webhook cho dashboard này.
