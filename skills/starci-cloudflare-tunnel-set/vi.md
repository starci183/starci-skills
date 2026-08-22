---
title: StarCi Cloudflare tunnel set
---

# starci-cloudflare-tunnel-set

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/vi.md` | vi | contract approval và output dùng chung |
| `@initialization` | `readiness/initialization/vi.md` | vi | sở hữu identity của Source và trạng thái route workspace |

## NESTED SKILLS

Không có.

## PIPELINE

Topology: `reconciliation`.

| Bước | Nhánh | Đầu vào | Cách thực hiện | Đầu ra bắt buộc | Điều kiện kiểm tra |
|---|---|---|---|---|---|
| ràng buộc | dùng chung | workspace route đã verify, hostname/service đã khai và credential identity | khóa tunnel cùng DNS ownership mong muốn | desired-state contract | project, role, zone và service đều rõ |
| kiểm kê | đối chiếu | desired state và Cloudflare read state | so tunnel, ingress và DNS records mà chưa mutation | reconciliation plan | mọi remote delta chính xác và credential-safe |
| duyệt-thực thi | thực thi | plan đã hiển thị và approval bắt buộc | chạy mutation idempotent qua control plane | apply receipt | có authority và chỉ record đã khai thay đổi |
| chứng minh | proof | apply receipt và fresh remote reads | đọc lại tunnel cùng DNS behavior | steady-state receipt | desired và observed state khớp, không lộ secret |

## Run

Đọc `@skill-shape`, rồi `@initialization`. Resolve ngôn ngữ chung của Source cùng project và role được
khai báo. Skill này chỉ tiêu thụ trạng thái initialization; nó không tạo/thay master identity và không sửa
route.

Luôn chạy helper ở plan mode trước:

```text
node .claude/scripts/cloudflare-tunnel-set.mjs --project <project> --role <role> --zone <zone> --hostname <hostname> --service <http-origin> --tunnel <name> --plan
```

Plan phải resolve route được yêu cầu, identity `~/.starci/master.identity` đang tồn tại, encrypted
workspace credential records và boundary chính xác của tunnel, ingress, DNS. Thiếu hoặc mơ hồ bất kỳ giá
trị nào thì dừng trước khi hỏi credential.

## Approval boundary

Tạo hoặc đổi tunnel, ingress, DNS record hay encrypted credential đều là external/product write. Hiển thị
plan không có value dưới `### NEED APPROVALS`; chỉ `OK` mới cho phép đúng các target đã nêu. Sau approval,
chạy lại đúng command đó nhưng bỏ `--plan`.

Khi record đã tồn tại, helper tái sử dụng `.workspace/credentials/cloudflare-api-token.key.enc` qua SOPS
identity đã khởi tạo. Nếu chưa có, helper đọc `CLOUDFLARE_API_TOKEN` từ process environment hoặc hỏi bằng
interactive prompt ẩn. Không nhận value qua chat, command argument hay plaintext config file và không bao
giờ in value. Credential được mã hóa trực
tiếp dưới workspace machine-local của Source:

- `.workspace/credentials/cloudflare-api-token.key.enc`
- `.workspace/credentials/cloudflare-<tunnel>-tunnel-token.key.enc`

Record đầu cấp quyền reconcile. Record sau là run token Cloudflare trả về cho named tunnel. Cả hai đều được
mã hóa bằng identity do initialization thiết lập. Đây là một control plane cấp Source dùng chung cho mọi
project đã khai báo; `project/role` chỉ chứng minh origin route, không scope Cloudflare account credential.
Skill không chạy connector. Product stack có thể sở hữu connector config và custody của run token riêng
mà không trở thành control plane.

## Reconciliation

Dùng một named tunnel remotely managed (`config_src: cloudflare`). Reuse theo exact name hoặc chỉ tạo một
lần. Merge hostname được yêu cầu vào ingress hiện có mà không xóa hostname khác, giữ đúng một rule cuối
`http_status:404`, và chỉ đổi configuration khi value khác. Tạo hoặc cập nhật một proxied CNAME tới
`<tunnel-id>.cfargotunnel.com`. Nếu đã có record xung đột thì từ chối thay vì ghi đè.

Chỉ origin `http://` và `https://` được phép. Từ chối credential trong origin URL, raw TCP scheme, port
datastore/admin đã biết và hostname mang identity datastore. Ngoại lệ cần một exposure policy chính xác
được duyệt riêng; skill không tự suy đoán hoặc bypass.

## Proof

Kết quả chỉ nêu tunnel, ingress và DNS đã create, update, reuse hay unchanged; không bao giờ chứa account
token, tunnel run token hoặc API response body. Xác nhận hai encrypted record tồn tại và không có plaintext
twin. Proof offline của helper là:

```text
node .claude/scripts/cloudflare-tunnel-set.mjs --self-test
```

Self-test dùng mock transport và không gọi ra ngoài.

## Stops

- thiếu initialization identity hoặc identity invalid → trả về initialization owner;
- route thiếu/stale → dừng trước khi đọc credential;
- quyền Cloudflare thiếu active-zone read, Tunnel Write hoặc DNS Write → báo access thiếu, không retry hay
  mở rộng quyền;
- origin vi phạm HTTP exposure policy hoặc DNS xung đột → từ chối mutation;
- encrypt thất bại → không gọi Cloudflare API; nếu encrypt run token thất bại sau retrieval thì báo external
  state chưa hoàn chỉnh và tuyệt đối không in token.

## Output

Nêu project/role đã route, public hostname, private HTTP origin, tunnel name, encrypted record paths,
verdict external change và proof. Không bao giờ output credential value.
